"""
Формирование Excel-отчёта «Количество проб»: копирование шаблона по каждому branch
с сохранением шрифтов и границ. Объединённые ячейки не копируются, чтобы при копировании
ячеек не было смещения.
В шаблоне: столбец A — филиал, столбец B — категории проб, столбец C — данные.
Шрифт на листе: Times New Roman, 12 pt.
Каждая строка значения столбца C (разделитель — перевод строки) выводится в отдельной
строке листа высотой 15 пунктов; столбец B объединяется на все строки категории.
"""

import base64
from copy import copy
from io import BytesIO
from typing import Any, Optional
import openpyxl
from openpyxl.cell.cell import Cell
from openpyxl.styles import Alignment, Border, Font, Side
from sqlalchemy.ext.asyncio import AsyncSession
from services.ilninm_reports.constants import (
    ROW_TITLE_KALIBROVOCHNAYA_NEFT_UGPU,
    ROW_TITLE_TOVARNAYA_NEFT_NGDU,
)
from services.ilninm_reports.sample_count import (
    ROW_TITLE_TO_BRANCH,
    _normalize_cell_a_for_match,
    get_sample_count_report_data,
    is_sample_count_row_visible_for_branch,
    match_row_title_to_value,
)
from utils.protocol_generator_utils import (
    copy_cell_style,
    copy_column_dimensions,
    copy_row_formatting,
)

# Шрифт всего отчёта.
REPORT_FONT_NAME = "Times New Roman"
REPORT_FONT_SIZE = 12

# Высота строки с текстом в столбце C (пункты Excel).
ROW_HEIGHT_COLUMN_C_LINES = 15
ROW_HEIGHT_COLUMN_C_SINGLE_LINE_TALL = 30

_ROW_TITLES_TALL_WHEN_SINGLE_LINE = frozenset(
    {
        ROW_TITLE_TOVARNAYA_NEFT_NGDU.lower(),
        ROW_TITLE_KALIBROVOCHNAYA_NEFT_UGPU.lower(),
    }
)


def _split_column_c_lines(value: str) -> list[str]:
    """Разбивает значение столбца C на строки листа; хвостовые пустые строки отбрасываются."""
    if not value or value == "—":
        return ["—"]
    parts = value.split("\n")
    while parts and not parts[-1].strip():
        parts.pop()
    return parts if parts else ["—"]


def _row_height_for_category(category_key: str, lines_in_category: int) -> float:
    """30 pt для однострочных «Товарная нефть НГДУ» и «Калибровочная нефть УГПУ», иначе 15 pt."""
    if (
        lines_in_category == 1
        and category_key.lower() in _ROW_TITLES_TALL_WHEN_SINGLE_LINE
    ):
        return ROW_HEIGHT_COLUMN_C_SINGLE_LINE_TALL
    return ROW_HEIGHT_COLUMN_C_LINES


def _set_fixed_row_height(
    ws: openpyxl.worksheet.worksheet.Worksheet, row: int, height: float
) -> None:
    """Фиксированная высота строки для вывода текста в C."""
    ws.row_dimensions[row].height = height


def _apply_report_font(cell: Cell) -> None:
    """Times New Roman 12; начертание и цвет из шаблона сохраняются."""
    old = cell.font
    if old:
        cell.font = Font(
            name=REPORT_FONT_NAME,
            size=REPORT_FONT_SIZE,
            bold=old.bold,
            italic=old.italic,
            underline=old.underline,
            strike=old.strike,
            color=copy(old.color) if old.color else None,
        )
        return
    cell.font = Font(name=REPORT_FONT_NAME, size=REPORT_FONT_SIZE)


def _cell_border_without_horizontal_edges(
    cell: Cell,
    *,
    remove_top: bool,
    remove_bottom: bool,
) -> None:
    """Снимает верхнюю и/или нижнюю границу ячейки, боковые не трогает."""
    if not remove_top and not remove_bottom:
        return
    old = cell.border or Border()
    cell.border = Border(
        left=old.left,
        right=old.right,
        top=Side(style=None) if remove_top else old.top,
        bottom=Side(style=None) if remove_bottom else old.bottom,
    )


def _apply_multiline_category_borders(
    ws: openpyxl.worksheet.worksheet.Worksheet,
    start_row: int,
    end_row: int,
) -> None:
    """
    Между строками одной категории в C убирает горизонтальные границы:
    у первой строки — нижнюю, у последней — верхнюю, у средних — обе.
    """
    line_count = end_row - start_row + 1
    if line_count <= 1:
        return
    for idx, row in enumerate(range(start_row, end_row + 1)):
        _cell_border_without_horizontal_edges(
            ws.cell(row=row, column=3),
            remove_top=idx > 0,
            remove_bottom=idx < line_count - 1,
        )


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
        "Внеплановые",
        "Паспортизация",
        "ГКП-21 ГКП-22",
        "ОИС Ачимовка",
        "ОИС Валанжин",
        "ОИС Ен-Яха",
        "ОИС",
        "Товарная продукция ОИС",
        "Прочие",
        "Нефтеконденсатная смесь",
        "Дизтопливо",
        "Ингибитор коррозии",
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
            if key and not is_sample_count_row_visible_for_branch(
                key, branch_name, ROW_TITLE_TO_BRANCH
            ):
                continue
            value_c = match_row_title_to_value(cell_b_value, row_values)
            column_c_lines = _split_column_c_lines(value_c if value_c else "—")
            category_start_row = current_row
            category_row_height = _row_height_for_category(
                key or "", len(column_c_lines)
            )

            for line_idx, line_text in enumerate(column_c_lines):
                out_row = current_row
                for col in (1, 2, 3):
                    src = template_ws.cell(row=template_row_idx, column=col)
                    tgt = new_ws.cell(row=out_row, column=col)
                    copy_cell_style(src, tgt)
                copy_row_formatting(
                    template_ws,
                    new_ws,
                    template_row_idx,
                    out_row,
                    merged_cells_map=None,
                )
                for col in (1, 2, 3):
                    _apply_report_font(new_ws.cell(row=out_row, column=col))
                _set_fixed_row_height(new_ws, out_row, category_row_height)

                new_ws.cell(row=out_row, column=1).value = (
                    branch_name if out_row == block_start_row else None
                )
                if line_idx == 0:
                    new_ws.cell(row=out_row, column=2).value = cell_b_value

                cell_c = new_ws.cell(row=out_row, column=3)
                cell_c.value = line_text
                old_align = cell_c.alignment
                cell_c.alignment = Alignment(
                    wrap_text=False,
                    horizontal=getattr(old_align, "horizontal", "general"),
                    vertical=getattr(old_align, "vertical", "top"),
                    text_rotation=getattr(old_align, "text_rotation", 0),
                    shrink_to_fit=getattr(old_align, "shrink_to_fit", False),
                    indent=getattr(old_align, "indent", 0),
                )
                current_row += 1

            category_end_row = current_row - 1
            _apply_multiline_category_borders(
                new_ws, category_start_row, category_end_row
            )
            if category_end_row > category_start_row:
                new_ws.merge_cells(
                    start_row=category_start_row,
                    start_column=2,
                    end_row=category_end_row,
                    end_column=2,
                )
                cell_b = new_ws.cell(row=category_start_row, column=2)
                old_b_align = cell_b.alignment
                cell_b.alignment = Alignment(
                    wrap_text=getattr(old_b_align, "wrap_text", False),
                    horizontal=getattr(old_b_align, "horizontal", "general"),
                    vertical="center",
                    text_rotation=getattr(old_b_align, "text_rotation", 0),
                    shrink_to_fit=getattr(old_b_align, "shrink_to_fit", False),
                    indent=getattr(old_b_align, "indent", 0),
                )

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
        for col in (1, 2, 3):
            _apply_report_font(new_ws.cell(row=row_idx, column=col))
        new_ws.cell(row=row_idx, column=1).alignment = alignment_center

    copy_column_dimensions(template_ws, new_ws)

    out = BytesIO()
    new_wb.save(out)
    return out.getvalue(), diagnostics_txt
