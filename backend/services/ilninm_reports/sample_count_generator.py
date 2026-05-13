"""
Формирование Excel-отчёта «Количество проб»: копирование шаблона по каждому branch
с сохранением шрифтов и границ. Объединённые ячейки не копируются, чтобы при копировании
ячеек не было смещения. Столбец C — перенос текста по словам.
В шаблоне: столбец A — пустой (место для branch), столбец B — категории проб, столбец C — заполняемые данные.
"""

import base64
import re
from io import BytesIO
from typing import Any, Optional
import openpyxl
from openpyxl.cell.rich_text import CellRichText, TextBlock
from openpyxl.cell.text import InlineFont
from openpyxl.styles import Alignment
from sqlalchemy.ext.asyncio import AsyncSession
from services.ilninm_reports.constants import (
    BRANCH_NGDU,
    BRANCH_UGPU,
    ROW_TITLE_EKSPLUATACIONNAYA_NEFT_NGDU,
    ROW_TITLE_KALIBROVOCHNAYA_NEFT_UGPU,
    ROW_TITLE_TOVARNAYA_NEFT_NGDU,
)
from services.ilninm_reports.sample_count import (
    _normalize_cell_a_for_match,
    get_sample_count_report_data,
    match_row_title_to_value,
)
from utils.protocol_generator_utils import (
    copy_cell_style,
    copy_column_dimensions,
    copy_row_formatting,
)

# Шаблоны для жирного выделения: «N шт», «N пок», «N шт по M пок».
_RE_BOLD_COUNTS = re.compile(r"\d+\s+шт(?:\s+по\s+\d+\s+пок)?|\d+\s+пок")


def _cell_value_with_bold_counts(value: str) -> str | CellRichText:
    """
    Возвращает значение для ячейки C: «N шт», «N пок» и «N шт по M пок» — жирным.
    """
    if not value or value == "—":
        return value
    matches = list(_RE_BOLD_COUNTS.finditer(value))
    if not matches:
        return value
    bold_font = InlineFont(b=True)
    plain_font = InlineFont(b=False)
    parts: list[TextBlock] = []
    last_end = 0
    for m in matches:
        if m.start() > last_end:
            mid = value[last_end : m.start()]
            if mid:
                normalized = mid.replace("\r\n", "\n").replace("\r", "\n")
                parts.append(TextBlock(plain_font, normalized))
        parts.append(TextBlock(bold_font, m.group(0)))
        last_end = m.end()
    if last_end < len(value):
        tail = value[last_end:]
        normalized_tail = tail.replace("\r\n", "\n").replace("\r", "\n")
        parts.append(TextBlock(plain_font, normalized_tail))
    return CellRichText(*parts)


# Строки, которые выводятся только в блоке соответствующего филиала.
_ROW_TITLE_ONLY_IN_BRANCH = {
    ROW_TITLE_TOVARNAYA_NEFT_NGDU: BRANCH_NGDU,
    ROW_TITLE_EKSPLUATACIONNAYA_NEFT_NGDU: BRANCH_NGDU,
    ROW_TITLE_KALIBROVOCHNAYA_NEFT_UGPU: BRANCH_UGPU,
}


def _get_cell_b_value(ws: openpyxl.worksheet.worksheet.Worksheet, row: int) -> Any:
    """Значение столбца B с учётом объединённых ячеек (берём верхнюю ячейку слияния)."""
    cell = ws.cell(row=row, column=2)
    if cell.value is not None:
        return cell.value
    for merged in ws.merged_cells.ranges:
        if (
            merged.min_col <= 2 <= merged.max_col
            and merged.min_row <= row <= merged.max_row
        ):
            return ws.cell(row=merged.min_row, column=2).value
    return None


def _find_template_data_rows(
    ws: openpyxl.worksheet.worksheet.Worksheet,
) -> list[tuple[int, Any]]:
    """
    Находит в шаблоне строки с категориями в столбце B.
    Учитывает объединённые ячейки: для каждой строки блока возвращается одна запись,
    чтобы последняя строка блока не терялась. Возвращает список (номер_строки, значение_ячейки_B).
    """
    known_titles = {
        "Товарная нефть НГДУ",
        "Эксплуатационная нефть НГДУ",
        "Калибровочная нефть УГПУ",
        "Внеплановая нефть",
        "Паспортизация",
        "ГКП-21 ГКП-22",
        "ОИС Ачимовка",
        "ОИС Валанжин",
        "ОИС Ен-Яха",
        "ОИС",
        "Товарная продукция ОИС",
        "Прочие",
        "Нефтеконденсатная смесь",
        "Дизтопливо Ингибитор коррозии",
    }
    result = []
    for row_idx in range(1, ws.max_row + 1):
        val = _get_cell_b_value(ws, row_idx)
        key = _normalize_cell_a_for_match(val)
        if not key:
            continue
        key_lower = key.lower()
        for title in known_titles:
            if title.lower() == key_lower:
                result.append((row_idx, val))
                break
    if not result:
        return result
    min_row = result[0][0]
    max_row = result[-1][0]
    expanded = []
    for merged in ws.merged_cells.ranges:
        if merged.min_col > 2 or merged.max_col < 2:
            continue
        if merged.max_row <= min_row or merged.min_row >= max_row:
            continue
        top_val = ws.cell(row=merged.min_row, column=2).value
        if top_val is None:
            continue
        for r in range(merged.min_row, merged.max_row + 1):
            if any(t[0] == r for t in result):
                continue
            expanded.append((r, top_val))
    result = sorted(result + expanded, key=lambda x: x[0])
    return result


async def build_sample_count_excel(
    db: AsyncSession,
    template_file_base64: str,
    laboratory_id: int,
    receiving_date_from: Optional[Any],
    receiving_date_to: Optional[Any],
    department_id: Optional[int] = None,
) -> tuple[bytes, bytes]:
    """
    Строит Excel-файл отчёта «Количество проб»: для каждого branch копируется
    блок шаблона (категории в столбце B), в столбец C подставляются данные.
    В первую строку каждого блока в столбец A записывается наименование branch.
    Пробы фильтруются по laboratory_id и department_id.
    """
    template_bytes = BytesIO(base64.b64decode(template_file_base64))
    template_wb = openpyxl.load_workbook(template_bytes)
    template_ws = template_wb.active
    data_rows = _find_template_data_rows(template_ws)
    if not data_rows:
        empty_txt = (
            "Диагностика не сформирована: в шаблоне не найдены строки категорий.\n"
        )
        return template_bytes.getvalue(), empty_txt.encode("utf-8")

    report_data = await get_sample_count_report_data(
        db,
        laboratory_id=laboratory_id,
        receiving_date_from=receiving_date_from,
        receiving_date_to=receiving_date_to,
        department_id=department_id,
    )
    by_branch = report_data.get("by_branch") or []
    diagnostics_txt = (report_data.get("diagnostics_txt") or "").encode("utf-8")

    new_wb = openpyxl.Workbook()
    new_ws = new_wb.active
    if template_ws.title:
        new_ws.title = template_ws.title
    current_row = 1

    for branch_block in by_branch:
        branch_name = branch_block.get("branch_name") or ""
        rows = branch_block.get("rows") or []
        row_values = {r["label"]: r["value"] for r in rows}

        block_start_row = current_row
        for template_row_idx, cell_b_value in data_rows:
            key = _normalize_cell_a_for_match(cell_b_value)
            if (
                key in _ROW_TITLE_ONLY_IN_BRANCH
                and _ROW_TITLE_ONLY_IN_BRANCH[key] != branch_name
            ):
                continue
            for col in (1, 2, 3):
                src = template_ws.cell(row=template_row_idx, column=col)
                tgt = new_ws.cell(row=current_row, column=col)
                copy_cell_style(src, tgt)
            copy_row_formatting(
                template_ws,
                new_ws,
                template_row_idx,
                current_row,
                merged_cells_map=None,
            )
            new_ws.cell(row=current_row, column=1).value = (
                branch_name if current_row == block_start_row else None
            )
            new_ws.cell(row=current_row, column=2).value = cell_b_value
            value_c = match_row_title_to_value(cell_b_value, row_values)
            cell_c_value = value_c if value_c else "—"
            cell_c = new_ws.cell(row=current_row, column=3)
            if "\n" in cell_c_value:
                cell_c.value = cell_c_value
            else:
                cell_c.value = _cell_value_with_bold_counts(cell_c_value)
            old_align = cell_c.alignment
            cell_c.alignment = Alignment(
                wrap_text=True,
                horizontal=getattr(old_align, "horizontal", "general"),
                vertical=getattr(old_align, "vertical", "top"),
                text_rotation=getattr(old_align, "text_rotation", 0),
                shrink_to_fit=getattr(old_align, "shrink_to_fit", False),
                indent=getattr(old_align, "indent", 0),
            )
            if template_ws.max_column >= 4:
                new_ws.merge_cells(
                    start_row=current_row,
                    start_column=3,
                    end_row=current_row,
                    end_column=4,
                )
            current_row += 1

        block_end_row = current_row - 1
        if block_end_row > block_start_row:
            new_ws.merge_cells(
                start_row=block_start_row,
                start_column=1,
                end_row=block_end_row,
                end_column=1,
            )

    alignment_center = Alignment(horizontal="center", vertical="center")
    for row_idx in range(1, new_ws.max_row + 1):
        new_ws.cell(row=row_idx, column=1).alignment = alignment_center

    copy_column_dimensions(template_ws, new_ws)

    out = BytesIO()
    new_wb.save(out)
    return out.getvalue(), diagnostics_txt
