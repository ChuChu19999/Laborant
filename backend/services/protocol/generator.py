from __future__ import annotations
import base64
from contextvars import ContextVar
from copy import copy
from dataclasses import dataclass
from io import BytesIO
import re
from typing import Any
import openpyxl
from openpyxl.styles import Border
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.cell_range import CellRange
from openpyxl.worksheet.dimensions import RowDimension
from openpyxl.worksheet.header_footer import _HeaderFooterPart
import orjson
import pendulum
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from core.exceptions import DomainValidationError, NotFoundError
from core.logger import logger
from models.calculation import Calculation
from models.equipment import Equipment
from models.nd_norm import NdNorm
from models.protocol import Protocol
from models.research import ResearchMethod
from models.sample import Sample
from models.selection_conditions import SelectionConditions
from services.employee import (
    get_employee_position_and_name,
)
from services.test_object import (
    get_protocol_abbreviations_by_names,
    pick_first_protocol_abbreviation,
)
from utils.calculation.fractional_keys import normalize_fractional_key
from utils.date import ensure_datetime
from utils.excel_typing import require_worksheet
from utils.protocol.template_markers import (
    END_WIDTH_MARKER,
    START_WIDTH_MARKER,
    adjust_cell_height_if_needed,
    apply_sheet_print_area,
    check_method_name,
    copy_cell_block,
    copy_cell_style,
    copy_column_dimensions,
    copy_row_dimension,
    copy_row_formatting,
    copy_row_with_styles,
    copy_sheet_page_settings,
    find_protocol_end_row,
    format_measurement_error_value,
    format_protocol_calculation_result,
    get_row_copy_max_col,
    get_template_content_bounds,
    group_name_matches,
    has_if_multiple_samples_marker,
    join_unique_values,
    parse_if_col_condition,
    parse_if_line_condition,
    purge_sheet_cells_beyond,
    strip_if_line_marker,
    strip_table1_structural_markers,
    template_contains_marker,
)
from utils.sample.formatting import format_well_display

# Аббревиатура для текущего формирования Excel (без протягивания по всем функциям).
_protocol_abbreviation_ctx: ContextVar[str] = ContextVar("protocol_abbreviation", default="")

TABLE1_END_MARKERS = {
    "{end_table1}",
}
TABLE_START_MARKERS = {
    "{start_table1}",
    "{start_table2}",
    "{start_table3}",
}
TABLE_END_MARKERS = {
    "{end_table1}",
    "{end_table2}",
    "{end_table3}",
}


def _existing_cols_in_row(sheet, row_num: int) -> list[int]:
    """Вернуть столбцы, уже созданные в строке (без раздувания max_column)."""
    return sorted(col for (row, col) in sheet._cells if row == row_num)


def _scan_row_max_col(sheet, row_num: int, col_limit: int = 60) -> int:
    """Вернуть верхнюю границу обхода строки шаблона или листа."""
    return get_row_copy_max_col(sheet, row_num, col_limit=col_limit)


async def process_cell_markers(
    protocol: Protocol,
    samples: list[Sample],
    cell_value: str,
    selection_conditions_templates: list[dict[str, Any]] | None = None,
    sampling_location_name_only: bool = False,
) -> str:
    """Обработать все метки в ячейке."""
    if not cell_value or not isinstance(cell_value, str):
        return cell_value

    if "{" not in cell_value:
        return cell_value

    try:
        if "{accreditation}" in cell_value:
            if not protocol.is_accredited:
                return "HIDE_ROW"
            cell_value = cell_value.replace("{accreditation}", "").strip()
            if "{" not in cell_value:
                return cell_value

        # Не аккредитован — после номера протокола в этой ячейке ничего не выводить.
        if not protocol.is_accredited and "{test_protocol_number}" in cell_value:
            prefix = cell_value.split("{test_protocol_number}", 1)[0]
            cell_value = f"{prefix}{{test_protocol_number}}"

        result = cell_value
        start = 0
        while True:
            start = result.find("{", start)
            if start == -1:
                break

            end = result.find("}", start)
            if end == -1:
                break

            marker = result[start + 1 : end]
            if marker.startswith("if line"):
                start = end + 1
                continue
            if not marker.startswith("sel_cond_") and marker != "bu":
                value = await get_marker_value_title(
                    protocol,
                    samples,
                    marker,
                    sampling_location_name_only=sampling_location_name_only,
                )
                result = result.replace(f"{{{marker}}}", value)
                continue

            start = end + 1

        processed_result = process_selection_conditions_row(samples, result, selection_conditions_templates)
        if processed_result is None:
            return "HIDE_ROW"
        return processed_result

    except Exception as e:  # noqa: BLE001
        logger.error(f"Ошибка при обработке меток в ячейке: {e!s}")
        return cell_value


def _employee_target_date(protocol: Protocol) -> pendulum.DateTime | None:
    """Вернуть дату протокола для должности и ФИО из HR."""
    raw = protocol.test_protocol_date or protocol.created_at
    if isinstance(raw, str):
        return ensure_datetime(pendulum.parse(raw))
    return ensure_datetime(raw)


async def get_marker_value_title(
    protocol: Protocol,
    samples: list[Sample],
    marker: str,
    *,
    sampling_location_name_only: bool = False,
) -> str:
    """Вернуть значение для метки в заголовке протокола."""
    try:
        if marker == "test_protocol_number":
            return str(protocol.test_protocol_number or "").strip()

        if marker == "date_protocol":
            if not protocol.test_protocol_date:
                return ""
            return pendulum.instance(protocol.test_protocol_date).format("DD.MM.YYYY")

        if marker == "abbreviation":
            return _protocol_abbreviation_ctx.get() or ""

        if marker == "accreditation":
            return ""

        elif marker == "subd":
            branches = [sample.branch.name for sample in samples if sample.branch and sample.branch.name]
            return join_unique_values(branches)

        elif marker == "tel":
            phones = [sample.phone for sample in samples if sample.phone]
            return join_unique_values(phones)

        elif marker == "res_object":
            objects = [sample.test_object for sample in samples if sample.test_object]
            return join_unique_values(objects)

        elif marker == "sampling_location":
            locations = []
            for sample in samples:
                location_parts = []
                if sample.sampling_location and sample.sampling_location.name:
                    location_parts.append(sample.sampling_location.name.strip())

                if not sampling_location_name_only:
                    well_display = format_well_display(sample.well)
                    if well_display:
                        location_parts.append(well_display)

                    if sample.mode and sample.mode.strip():
                        location_parts.append(sample.mode.strip())

                if location_parts:
                    locations.append(" ".join(location_parts))
            return join_unique_values(locations)

        elif marker == "mode":
            modes = [sample.mode.strip() for sample in samples if sample.mode and sample.mode.strip()]
            return join_unique_values(modes)

        elif marker == "sampling_date":
            dates = sorted(
                set(
                    pendulum.instance(sample.sampling_date).format("DD.MM.YYYY")
                    for sample in samples
                    if sample.sampling_date
                )
            )
            return ", ".join(dates) if dates else ""

        elif marker == "receiving_date":
            dates = sorted(
                set(
                    pendulum.instance(sample.receiving_date).format("DD.MM.YYYY")
                    for sample in samples
                    if sample.receiving_date
                )
            )
            return ", ".join(dates) if dates else ""

        elif marker == "laboratory_activity_dates":
            dates = []
            for sample in samples:
                for calc in sample.calculations:
                    if calc.deleted_at is None and calc.laboratory_activity_date:
                        dates.append(calc.laboratory_activity_date)
            if dates:
                min_date = pendulum.instance(min(dates)).format("DD.MM.YYYY")
                max_date = pendulum.instance(max(dates)).format("DD.MM.YYYY")
                return f"{min_date}-{max_date}" if min_date != max_date else min_date
            return ""

        elif marker == "lab_location":
            if (
                protocol.department
                and hasattr(protocol.department, "laboratory_location")
                and protocol.department.laboratory_location
            ):
                return protocol.department.laboratory_location
            elif (
                protocol.laboratory
                and hasattr(protocol.laboratory, "laboratory_location")
                and protocol.laboratory.laboratory_location
            ):
                return protocol.laboratory.laboratory_location
            return ""

        elif marker == "sampling_act_number":
            return protocol.sampling_act_number or ""

        elif marker == "registration_number":
            numbers = [sample.registration_number for sample in samples if sample.registration_number]
            return join_unique_values(numbers)

        elif marker == "workplace_issued":
            if protocol.issued_position:
                return protocol.issued_position
            elif protocol.issued:
                position, _ = await get_employee_position_and_name(protocol.issued, _employee_target_date(protocol))
                return position
            return ""

        elif marker == "issued":
            if protocol.issued:
                _, formatted_name = await get_employee_position_and_name(
                    protocol.issued, _employee_target_date(protocol)
                )
                return formatted_name
            return ""

        elif marker == "workplace_approved":
            if protocol.approved_position:
                return protocol.approved_position
            elif protocol.approved:
                position, _ = await get_employee_position_and_name(protocol.approved, _employee_target_date(protocol))
                return position
            return ""

        elif marker == "approved":
            if protocol.approved:
                _, formatted_name = await get_employee_position_and_name(
                    protocol.approved, _employee_target_date(protocol)
                )
                return formatted_name
            return ""

        return ""
    except Exception as e:  # noqa: BLE001
        logger.error(f"Ошибка при получении значения для метки {marker}: {e!s}")
        return ""


def process_selection_conditions_row(
    samples: list[Sample],
    cell_value: str,
    selection_conditions_templates: list[dict[str, Any]] | None = None,
) -> str | None:
    """Обработать метки условий отбора в ячейке."""
    if not cell_value or not isinstance(cell_value, str):
        return cell_value

    if "{sel_cond_" not in cell_value and "{bu}" not in cell_value:
        return cell_value

    # Создать словарь для поиска единиц измерения по названию переменной.
    unit_map = {}
    if selection_conditions_templates:
        for template in selection_conditions_templates:
            if isinstance(template, dict) and "conditions" in template:
                conditions = template.get("conditions") or []
                if isinstance(conditions, list):
                    for condition_template in conditions:
                        if isinstance(condition_template, dict):
                            variable = condition_template.get("variable", "")
                            unit = condition_template.get("unit", "")
                            if variable:
                                unit_map[variable] = unit

    all_conditions = []
    for sample in samples:
        if not sample.selection_conditions:
            continue

        sample_conditions = sample.selection_conditions

        # Поддержка формата, когда условия хранятся в виде.
        # {"conditions": [ ... ]}
        if isinstance(sample_conditions, dict) and "conditions" in sample_conditions:
            sample_conditions = sample_conditions.get("conditions") or []

        # Поддержка формата, когда условия хранятся в виде.
        # {"Давление": "4.33", "Температура": "-6", ...}
        # где ключ — название переменной, значение — значение условия.
        # Единицы измерения берутся из шаблонов SelectionConditions.
        if isinstance(sample_conditions, dict) and "conditions" not in sample_conditions:
            for variable, value in sample_conditions.items():
                if variable and value and str(value).strip() != "":
                    formatted_value = str(value).replace(".", ",")
                    # Искать единицу измерения в шаблонах по названию переменной.
                    unit = unit_map.get(variable, "")
                    all_conditions.append(
                        {
                            "variable": variable,
                            "value": formatted_value,
                            "unit": unit,
                        }
                    )
            continue

        if isinstance(sample_conditions, list):
            for condition_item in sample_conditions:
                if isinstance(condition_item, dict):
                    variable = condition_item.get("variable", "")
                    value = condition_item.get("value", "")
                    unit = condition_item.get("unit", "")

                    if variable and value and str(value).strip() != "":
                        formatted_value = str(value).replace(".", ",")
                        all_conditions.append(
                            {
                                "variable": variable,
                                "value": formatted_value,
                                "unit": unit,
                            }
                        )

    has_condition_tags = "{sel_cond_" in cell_value

    if not all_conditions:
        if has_condition_tags:
            return None
        if "{bu}" in cell_value:
            return cell_value.replace("{bu}", "б/у")
        return cell_value

    current_index = None
    for i in range(1, 6):
        if re.search(r"\{sel_cond_[^}]*_" + str(i) + r"\}", cell_value):
            current_index = i
            break

    if has_condition_tags and current_index is None:
        return None

    if current_index is not None and current_index > len(all_conditions):
        return None

    if current_index is not None and current_index <= len(all_conditions):
        condition = all_conditions[current_index - 1]

        if not condition["value"] or condition["value"].strip() == "":
            return None

        result = cell_value
        name_aliases = {"name", "var", "variable"}
        value_aliases = {"val", "value"}
        unit_aliases = {"unit", "units", "measure"}

        tags_for_index = re.findall(r"\{sel_cond_([^}]+)_" + str(current_index) + r"\}", result)
        for tag_key in set(tags_for_index):
            if tag_key in name_aliases:
                result = result.replace(
                    f"{{sel_cond_{tag_key}_{current_index}}}",
                    condition["variable"],
                )
            elif tag_key in value_aliases:
                result = result.replace(
                    f"{{sel_cond_{tag_key}_{current_index}}}",
                    condition["value"],
                )
            elif tag_key in unit_aliases:
                result = result.replace(
                    f"{{sel_cond_{tag_key}_{current_index}}}",
                    condition["unit"],
                )
            else:
                result = result.replace(f"{{sel_cond_{tag_key}_{current_index}}}", "")

        if "{bu}" in result:
            result = result.replace("{bu}", "")

        if result.strip() == "" or result.strip() == " ":
            return None

        return result

    if "{bu}" in cell_value:
        cell_value = cell_value.replace("{bu}", "")

    return cell_value


async def process_header(
    protocol: Protocol,
    samples: list[Sample],
    template_sheet,
    new_sheet,
    merged_cells_map,
    selection_conditions_templates: list[dict[str, Any]] | None = None,
    sampling_location_name_only: bool = False,
):
    """Обработать шапку протокола."""
    current_row_new = 1
    found_start = False
    last_row = template_sheet.max_row

    for current_row in range(1, template_sheet.max_row + 1):
        row = next(iter(template_sheet.iter_rows(min_row=current_row, max_row=current_row, values_only=True)))

        if not found_start:
            if any(cell and str(cell).strip() == "{{start_header}}" for cell in row):
                found_start = True
            continue

        if any(cell and str(cell).strip() == "{{end_header}}" for cell in row):
            return current_row + 1

        copy_row_dimension(template_sheet, new_sheet, current_row, current_row_new)

        for merged_range in template_sheet.merged_cells.ranges:
            if merged_range.min_row == current_row:
                new_range = CellRange(
                    min_col=merged_range.min_col,
                    min_row=current_row_new,
                    max_col=merged_range.max_col,
                    max_row=current_row_new + (merged_range.max_row - merged_range.min_row),
                )
                merged_cells_map.add(new_range)

        copy_row_with_styles(template_sheet, new_sheet, current_row, current_row_new)

        skip_row = False
        row_max_col = get_row_copy_max_col(template_sheet, current_row)
        for col in range(1, row_max_col + 1):
            cell = new_sheet.cell(row=current_row_new, column=col)
            if cell.value:
                processed_value = await process_cell_markers(
                    protocol,
                    samples,
                    str(cell.value),
                    selection_conditions_templates,
                    sampling_location_name_only,
                )
                if processed_value == "HIDE_ROW":
                    skip_row = True
                    break
                elif processed_value is not None:
                    cell.value = processed_value

        if skip_row:
            new_sheet.row_dimensions[current_row_new].hidden = True

        current_row_new += 1
        last_row = current_row

    return last_row


async def process_header_and_conditions(
    protocol: Protocol,
    samples: list[Sample],
    template_sheet,
    new_sheet,
    start_row,
    merged_cells_map,
    selection_conditions_templates: list[dict[str, Any]] | None = None,
    sampling_location_name_only: bool = False,
):
    """Обработать заголовок и условия отбора после шапки до начала таблицы."""
    current_row_new = new_sheet.max_row + 1
    template_last_row, _ = get_template_content_bounds(template_sheet)
    last_row = start_row

    for current_row in range(start_row, template_last_row + 1):
        row = next(iter(template_sheet.iter_rows(min_row=current_row, max_row=current_row, values_only=True)))

        if any(cell and str(cell).strip() == "{start_table1}" for cell in row):
            return current_row

        skip_row = False
        processed_values = []

        for cell_value in row:
            if cell_value:
                processed_value = await process_cell_markers(
                    protocol,
                    samples,
                    str(cell_value),
                    selection_conditions_templates,
                    sampling_location_name_only,
                )
                if processed_value == "HIDE_ROW":
                    skip_row = True
                    break
                elif processed_value is not None:
                    processed_values.append(processed_value)
                else:
                    processed_values.append(cell_value)
            else:
                processed_values.append(cell_value)

        if skip_row:
            continue

        copy_row_dimension(template_sheet, new_sheet, current_row, current_row_new)

        for merged_range in template_sheet.merged_cells.ranges:
            if merged_range.min_row == current_row:
                new_range = CellRange(
                    min_col=merged_range.min_col,
                    min_row=current_row_new,
                    max_col=merged_range.max_col,
                    max_row=current_row_new + (merged_range.max_row - merged_range.min_row),
                )
                merged_cells_map.add(new_range)

        copy_row_with_styles(template_sheet, new_sheet, current_row, current_row_new)

        for col, processed_value in enumerate(processed_values, start=1):
            if processed_value is not None:
                cell = new_sheet.cell(row=current_row_new, column=col)
                cell.value = processed_value

        current_row_new += 1
        last_row = current_row

    return last_row


async def process_footer_test_protocol_number(protocol: Protocol, samples: list[Sample], text) -> _HeaderFooterPart:
    """Подставить номер протокола и аббревиатуру в тексте колонтитула."""
    orig_text = text
    if hasattr(text, "text"):
        text = text.text
    if not text or not isinstance(text, str):
        return orig_text

    # Не аккредитован — после номера протокола ничего не выводить.
    if not protocol.is_accredited and "{test_protocol_number}" in text:
        prefix = text.split("{test_protocol_number}", 1)[0]
        text = f"{prefix}{{test_protocol_number}}"

    number = await get_marker_value_title(protocol, samples, "test_protocol_number")
    abbreviation = await get_marker_value_title(protocol, samples, "abbreviation")
    date_protocol = await get_marker_value_title(protocol, samples, "date_protocol")
    result = text.replace("{test_protocol_number}", number)
    result = result.replace("{abbreviation}", abbreviation)
    result = result.replace("{date_protocol}", date_protocol)

    prefix = '&"Times New Roman,Обычный"'
    size_mark = "&11"
    if result.startswith(prefix):
        after = result[len(prefix) :]
        if after.startswith("&") and len(after) > 1 and after[1].isdigit():
            idx = 2
            while idx < len(after) and after[idx].isdigit():
                idx += 1
            after = after[idx:]
        if not after.startswith(size_mark):
            after = size_mark + after
        result = prefix + after
    else:
        result = f"{prefix}{size_mark}{result}"

    return _HeaderFooterPart(text=result)


async def process_footer(
    protocol: Protocol,
    samples: list[Sample],
    template_sheet,
    current_sheet,
    footer_start,
    merged_cells_map,
    current_row,
    selection_conditions_templates: list[dict[str, Any]] | None = None,
    sampling_location_name_only: bool = False,
):
    """Обработать оставшиеся строки после последней таблицы (подвал протокола)."""
    template_last_row, template_last_col = get_template_content_bounds(template_sheet)

    for row_num in range(footer_start + 1, template_last_row + 1):
        row = next(iter(template_sheet.iter_rows(min_row=row_num, max_row=row_num, values_only=True)))
        if any(cell and str(cell).strip() in TABLE_END_MARKERS for cell in row):
            continue

        copy_row_dimension(template_sheet, current_sheet, row_num, current_row)

        for merged_range in template_sheet.merged_cells.ranges:
            if merged_range.min_row == row_num:
                new_range = CellRange(
                    min_col=merged_range.min_col,
                    min_row=current_row,
                    max_col=merged_range.max_col,
                    max_row=current_row + (merged_range.max_row - merged_range.min_row),
                )
                merged_cells_map.add(new_range)

        for col in range(1, template_last_col + 1):
            source_cell = template_sheet.cell(row=row_num, column=col)
            target_cell = current_sheet.cell(row=current_row, column=col)

            target_cell.value = source_cell.value
            copy_cell_style(source_cell, target_cell)

        for col in range(1, template_last_col + 1):
            cell = current_sheet.cell(row=current_row, column=col)
            if cell.value:
                processed_value = await process_cell_markers(
                    protocol,
                    samples,
                    str(cell.value),
                    selection_conditions_templates,
                    sampling_location_name_only,
                )
                if processed_value is not None:
                    cell.value = processed_value

        if find_protocol_end_row(current_sheet) == current_row:
            current_row += 1
            break

        current_row += 1

    return current_sheet


async def process_between_tables(
    protocol: Protocol,
    samples: list[Sample],
    template_sheet,
    current_sheet,
    table_end,
    merged_cells_map,
    current_row,
    selection_conditions_templates: list[dict[str, Any]] | None = None,
    sampling_location_name_only: bool = False,
):
    """Обработать данные между таблицами."""
    template_last_row, _ = get_template_content_bounds(template_sheet)

    next_table_start = None
    for row_num in range(table_end + 1, template_last_row + 1):
        row = next(iter(template_sheet.iter_rows(min_row=row_num, max_row=row_num, values_only=True)))
        if any(cell and str(cell).strip() in TABLE_START_MARKERS for cell in row):
            next_table_start = row_num
            break

    if not next_table_start:
        return current_sheet, current_row

    executors_cache = set()
    target_date = _employee_target_date(protocol)

    unique_executors = set()
    for sample in samples:
        for calc in sample.calculations:
            if calc.deleted_at is None and calc.executor:
                unique_executors.add(calc.executor)

    for executor_hsnils in unique_executors:
        position, formatted_name = await get_employee_position_and_name(executor_hsnils, target_date)
        if formatted_name:
            logger.info(f"Из HR API получили: ФИО={formatted_name}, должность={position or ''}")
            position_lower = position.lower() if position else ""
            executor_info = f"{position_lower} {formatted_name}".strip() if position_lower else formatted_name
            executors_cache.add(executor_info)

    executors = sorted(executors_cache) if executors_cache else []

    row_with_executor = None
    executor_column = None

    for row_num in range(table_end + 1, next_table_start):
        row = next(iter(template_sheet.iter_rows(min_row=row_num, max_row=row_num, values_only=True)))

        if any(cell and str(cell).strip() in TABLE_END_MARKERS for cell in row):
            continue

        for col_idx, cell_value in enumerate(row, 1):
            if cell_value and "{executor}" in str(cell_value):
                row_with_executor = row_num
                executor_column = col_idx
                break

        if row_with_executor:
            break

    for row_num in range(table_end + 1, next_table_start):
        row = next(iter(template_sheet.iter_rows(min_row=row_num, max_row=row_num, values_only=True)))

        if any(cell and str(cell).strip() in TABLE_END_MARKERS for cell in row):
            continue

        copy_row_formatting(template_sheet, current_sheet, row_num, current_row, merged_cells_map)

        if row_num == row_with_executor and executors and executor_column:
            row_max_col = _scan_row_max_col(template_sheet, row_num)
            for col in range(1, row_max_col + 1):
                cell = current_sheet.cell(row=current_row, column=col)
                if cell.value:
                    if col == executor_column and "{executor}" in str(cell.value):
                        cell.value = str(cell.value).replace("{executor}", executors[0])
                    else:
                        processed_value = await process_cell_markers(
                            protocol,
                            samples,
                            str(cell.value),
                            selection_conditions_templates,
                            sampling_location_name_only,
                        )
                        if processed_value is not None:
                            cell.value = processed_value

            current_row += 1

            for executor in executors[1:]:
                copy_row_formatting(
                    template_sheet,
                    current_sheet,
                    row_num,
                    current_row,
                    merged_cells_map,
                )

                for col in range(1, row_max_col + 1):
                    cell = current_sheet.cell(row=current_row, column=col)
                    if cell.value:
                        if col == executor_column and "{executor}" in str(cell.value):
                            cell.value = str(cell.value).replace("{executor}", executor)
                        else:
                            cell.value = ""

                current_row += 1
        else:
            row_max_col = _scan_row_max_col(template_sheet, row_num)
            for col in range(1, row_max_col + 1):
                cell = current_sheet.cell(row=current_row, column=col)
                if cell.value:
                    processed_value = await process_cell_markers(
                        protocol,
                        samples,
                        str(cell.value),
                        selection_conditions_templates,
                        sampling_location_name_only,
                    )
                    if processed_value is not None:
                        cell.value = processed_value

            current_row += 1

    return current_sheet, current_row


def _method_group_names(method: ResearchMethod) -> list[str]:
    """Вернуть активные имена групп методики."""
    names: list[str] = []
    for group in method.groups or []:
        if group.deleted_at is not None:
            continue
        name = (group.name or "").strip()
        if name:
            names.append(name)
    return names


def _primary_group_name(method: ResearchMethod | None) -> str:
    """Вернуть первое активное имя группы методики или пустую строку."""
    if not method:
        return ""
    names = _method_group_names(method)
    return names[0] if names else ""


def _find_calculation_for_if_line(
    conditions: dict[str, str],
    calculations: list[Calculation],
) -> Calculation | None:
    """Найти расчёт, подходящий под условие {if line}."""
    required_name = (conditions.get("name_method") or "").strip()
    required_group = (conditions.get("group_name") or "").strip()

    for calc in calculations:
        method = calc.research_method
        if not method:
            continue
        if required_name and (method.name or "").strip() != required_name:
            continue
        if required_group:
            group_names = _method_group_names(method)
            if not any(group_name_matches(required_group, name) for name in group_names):
                continue
        return calc
    return None


def _row_has_fractional_markers(template_sheet, row_num: int) -> bool:
    """Проверить, есть ли в строке шаблона fractional-метки."""
    for col in range(1, _scan_row_max_col(template_sheet, row_num) + 1):
        value = template_sheet.cell(row=row_num, column=col).value
        if value and isinstance(value, str) and "{fractional_" in value:
            return True
    return False


def _fill_method_row_placeholders(
    current_sheet,
    row_num: int,
    *,
    method_id: str | None,
    calc: Calculation | None,
    clear_all: bool = False,
) -> None:
    """Подставить метки таблицы 1."""
    for col in _existing_cols_in_row(current_sheet, row_num):
        cell = current_sheet.cell(row=row_num, column=col)
        if not cell.value or not isinstance(cell.value, str):
            continue
        value = strip_if_line_marker(str(cell.value))
        if clear_all:
            for marker in (
                "{id_method}",
                "{result}",
                "{measurement_error}",
                "{measurement_method}",
                "{unit}",
                "{name_method}",
                "{group_name}",
                "{fractional_data}",
                "{fractional_unit}",
                "{fractional_result}",
                "{fractional_error}",
                "{fractional_measurement_method}",
            ):
                value = value.replace(marker, "")
            cell.value = value.strip() or None
            continue

        if "{id_method}" in value:
            value = value.replace("{id_method}", method_id if method_id is not None else "")
        if calc is not None:
            if "{name_method}" in value:
                value = value.replace("{name_method}", calc.research_method.name or "")
            if "{group_name}" in value:
                value = value.replace("{group_name}", _primary_group_name(calc.research_method))
            if "{unit}" in value:
                value = value.replace("{unit}", calc.unit or "-")
            if "{result}" in value:
                value = value.replace("{result}", format_protocol_calculation_result(calc))
            if "{measurement_error}" in value:
                value = value.replace(
                    "{measurement_error}",
                    format_measurement_error_value(calc.measurement_error),
                )
            if "{measurement_method}" in value:
                measurement_method = calc.research_method.measurement_method or "-"
                value = value.replace("{measurement_method}", measurement_method)
                adjust_cell_height_if_needed(current_sheet, row_num, col, measurement_method)
        else:
            for marker in (
                "{result}",
                "{measurement_error}",
                "{measurement_method}",
                "{unit}",
                "{name_method}",
                "{group_name}",
            ):
                value = value.replace(marker, "")
        cell.value = value.strip() if value.strip() else None


def _hide_template_row(
    template_sheet,
    current_sheet,
    template_row: int,
    target_row: int,
    merged_cells_map,
) -> int:
    """Скопировать строку шаблона и скрыть её (условие if line не выполнено)."""
    copy_row_formatting(
        template_sheet,
        current_sheet,
        template_row,
        target_row,
        merged_cells_map,
    )
    _fill_method_row_placeholders(current_sheet, target_row, method_id=None, calc=None, clear_all=True)
    if target_row not in current_sheet.row_dimensions:
        current_sheet.row_dimensions[target_row] = RowDimension(current_sheet, target_row)
    current_sheet.row_dimensions[target_row].hidden = True
    return target_row + 1


def _fill_fractional_placeholders(
    current_sheet,
    row_num: int,
    *,
    method_id: str | None,
    method_name: str,
    group_name: str,
    data_name: str,
    unit: str,
    result: str,
    error: str,
    measurement_method: str,
) -> None:
    """Подставить fractional-метки и {name_method}/{group_name} как есть."""
    for col in _existing_cols_in_row(current_sheet, row_num):
        cell = current_sheet.cell(row=row_num, column=col)
        if not cell.value or not isinstance(cell.value, str):
            continue
        value = strip_if_line_marker(str(cell.value))
        if "{id_method}" in value:
            value = value.replace("{id_method}", method_id if method_id is not None else "")
        value = value.replace("{fractional_data}", data_name)
        value = value.replace("{fractional_unit}", unit)
        value = value.replace("{fractional_result}", result)
        value = value.replace("{fractional_error}", error)
        if "{name_method}" in value:
            value = value.replace("{name_method}", method_name)
        if "{group_name}" in value:
            value = value.replace("{group_name}", group_name)
        if "{unit}" in value:
            value = value.replace("{unit}", unit)
        if "{fractional_measurement_method}" in value:
            value = value.replace("{fractional_measurement_method}", measurement_method)
            adjust_cell_height_if_needed(current_sheet, row_num, col, measurement_method)
        for marker in (
            "{result}",
            "{measurement_error}",
            "{measurement_method}",
        ):
            value = value.replace(marker, "")
        cell.value = value.strip() if value.strip() else None


def _iter_fractional_oil_rows(calc: Calculation) -> list[tuple[str, str, str, str]]:
    """Вернуть строки фракционного состава нефти: (name, unit, result, error)."""
    try:
        result_data = orjson.loads(calc.result) if isinstance(calc.result, str) else calc.result

        if isinstance(result_data, dict) and "_fractional_data" in result_data:
            fractional_data = result_data["_fractional_data"]
            combined_data = {}
            for card_data in fractional_data.values():
                if isinstance(card_data, dict):
                    for field, value in card_data.items():
                        if field not in combined_data or combined_data[field] is None or combined_data[field] == "":
                            combined_data[field] = value
            result_data = combined_data

        if isinstance(result_data, dict):
            normalized_data = {}
            for key, value in result_data.items():
                normalized_key = normalize_fractional_key(key)
                normalized_data[normalized_key] = value
            result_data = normalized_data
    except (orjson.JSONDecodeError, TypeError) as e:
        logger.error(f"Не удалось распарсить результат для фракционного состава нефти: {e!s}")
        return []

    if not isinstance(result_data, dict):
        return []

    error_map = {
        "Температура н.к.": "±5",
        "Выход фракций до 100 ℃": "±1,4",
        "Выход фракций до 150 ℃": "±1,4",
        "Выход фракций до 200 ℃": "±1,4",
        "Выход фракций до 250 ℃": "±1,4",
        "Выход фракций до 270 ℃": "±1,4",
        "Выход фракций до 300 ℃": "±1,4",
    }
    fields = [
        "Температура н.к.",
        "Выход фракций до 100 ℃",
        "Выход фракций до 150 ℃",
        "Выход фракций до 200 ℃",
        "Выход фракций до 250 ℃",
        "Выход фракций до 270 ℃",
        "Выход фракций до 300 ℃",
    ]
    rows: list[tuple[str, str, str, str]] = []
    rows.append(("Фракционный состав:", "", "", ""))
    output_header_done = False
    for field in fields:
        raw = result_data.get(field)
        if raw is None or raw == "" or raw == "-":
            continue
        if field.startswith("Выход фракций") and not output_header_done:
            rows.append(("Выход фракций до температуры:", "%", "", ""))
            output_header_done = True
        try:
            num = float(str(raw).replace(",", "."))
            result_text = "выше 360" if field == "Температура н.к." and num > 360 else str(raw).replace(".", ",")
        except (ValueError, TypeError):
            result_text = str(raw).replace(".", ",")
        if field == "Температура н.к.":
            name, unit = "Температура н.к.", "°C"
        else:
            name = field.replace("Выход фракций до ", "")
            unit = ""
        rows.append((name, unit, result_text, error_map.get(field, "-")))
    return rows


def _iter_fractional_condensate_rows(
    calc: Calculation,
) -> list[tuple[str, str, str, str]]:
    """Вернуть строки фракционного состава конденсата: (name, unit, result, error)."""
    try:
        result_data = orjson.loads(calc.result) if isinstance(calc.result, str) else calc.result
    except (orjson.JSONDecodeError, TypeError) as e:
        logger.error(f"Не удалось распарсить результат для фракционного состава конденсата: {e!s}")
        return []

    if not isinstance(result_data, dict):
        return []

    normalized = {}
    for key, value in result_data.items():
        key_l = str(key).lower()
        if key_l.startswith("температура н"):
            normalized["Температура н.к."] = value
        else:
            normalized[key] = value
    result_data = normalized

    error_map = {
        "Температура н.к.": "±5",
        "10% отгона при температуре": "±4",
        "50% отгона при температуре": "±2",
        "90% отгона при температуре": "±5",
        "Температура к.к.": None,
        "Объёмная доля остатка": "±0,3",
    }
    fields = [
        "Температура н.к.",
        "5% отгона при температуре",
        "10% отгона при температуре",
        "20% отгона при температуре",
        "30% отгона при температуре",
        "40% отгона при температуре",
        "50% отгона при температуре",
        "60% отгона при температуре",
        "70% отгона при температуре",
        "80% отгона при температуре",
        "90% отгона при температуре",
        "95% отгона при температуре",
        "98% отгона при температуре",
        "Температура к.к.",
        "Объёмная доля отгона",
        "Объёмная доля остатка",
        "Объёмная доля потерь",
    ]
    rows: list[tuple[str, str, str, str]] = []
    rows.append(("Фракционный состав:", "", "", ""))
    first_percent_done = False
    for field in fields:
        raw = result_data.get(field)
        if raw is None or raw == "" or raw == "-":
            continue
        raw_s = str(raw).replace(".", ",")
        try:
            num = float(str(raw).replace(",", "."))
            if (field in ("Температура н.к.", "Температура к.к.") or "отгона при температуре" in field) and num > 360:
                result_text = "выше 360"
            else:
                result_text = raw_s
        except (ValueError, TypeError):
            result_text = raw_s
            num = None

        if "отгона при температуре" in field:
            if not first_percent_done:
                name = field[0].upper() + field[1:] if field else field
                first_percent_done = True
            else:
                name = field.split("%")[0] + "%"
            unit = "°C"
        elif field in ("Температура н.к.", "Температура к.к."):
            name, unit = field, "°C"
        elif "доля" in field.lower():
            name = field[0].upper() + field[1:] if field else field
            unit = "%"
        else:
            name = field[0].upper() + field[1:] if field else field
            unit = ""

        if field == "Температура к.к.":
            error = _condensate_kk_measurement_error(raw)
        else:
            error = error_map.get(field, "-")
            if error is None:
                error = "-"
        rows.append((name, unit, result_text, error))
    return rows


def _clear_row_horizontal_borders(
    sheet,
    row_num: int,
    *,
    clear_top: bool = False,
    clear_bottom: bool = False,
) -> None:
    """Убрать верхнюю и/или нижнюю границу у ячеек строки."""
    for col in _existing_cols_in_row(sheet, row_num):
        cell = sheet.cell(row=row_num, column=col)
        if not cell.border:
            continue
        new_border = copy(cell.border)
        if clear_top:
            new_border.top = None
        if clear_bottom:
            new_border.bottom = None
        cell.border = new_border


def _restore_row_bottom_border_from_template(
    template_sheet,
    current_sheet,
    template_row: int,
    target_row: int,
) -> None:
    """Восстановить нижнюю границу строки по образцу из шаблона."""
    _apply_row_bottom_from_template_edge(
        template_sheet,
        current_sheet,
        template_row,
        target_row,
        source_edge="bottom",
    )


def _template_row_has_edge_border(
    template_sheet,
    row_num: int,
    *,
    edge: str,
) -> bool:
    """Проверить, есть ли у строки шаблона горизонтальная граница top/bottom."""
    for col in range(1, _scan_row_max_col(template_sheet, row_num) + 1):
        border = template_sheet.cell(row=row_num, column=col).border
        if not border:
            continue
        side = getattr(border, edge, None)
        if side is not None and side.style:
            return True
    return False


def _apply_row_bottom_from_template_edge(
    template_sheet,
    current_sheet,
    template_row: int,
    target_row: int,
    *,
    source_edge: str,
) -> None:
    """Скопировать top/bottom границы строки шаблона как нижнюю границу целевой строки."""
    for col in range(1, _scan_row_max_col(template_sheet, template_row) + 1):
        source = template_sheet.cell(row=template_row, column=col)
        target = current_sheet.cell(row=target_row, column=col)
        src_border = source.border
        if not src_border:
            continue
        side = getattr(src_border, source_edge, None)
        if side is None or not side.style:
            continue
        new_border = copy(target.border) if target.border else Border()
        new_border.bottom = copy(side)
        target.border = new_border


def _close_previous_visible_row_before_id_method(
    template_sheet,
    current_sheet,
    *,
    next_template_row: int,
    last_visible_output_row: int | None,
    hidden_template_rows: list[int],
) -> None:
    """
    Закрыть предыдущий видимый блок нижней границей перед строкой с {id_method}.

    Сначала взять верхнюю границу этой id-строки из шаблона (если есть),
    иначе — нижнюю границу последней скрытой строки между блоками.
    """
    if last_visible_output_row is None:
        return

    if _template_row_has_edge_border(template_sheet, next_template_row, edge="top"):
        _apply_row_bottom_from_template_edge(
            template_sheet,
            current_sheet,
            next_template_row,
            last_visible_output_row,
            source_edge="top",
        )
        return

    for hidden_row in reversed(hidden_template_rows):
        if _template_row_has_edge_border(template_sheet, hidden_row, edge="bottom"):
            _apply_row_bottom_from_template_edge(
                template_sheet,
                current_sheet,
                hidden_row,
                last_visible_output_row,
                source_edge="bottom",
            )
            return


def _expand_fractional_if_line_row(
    calc: Calculation,
    template_sheet,
    current_sheet,
    template_row: int,
    current_row: int,
    merged_cells_map,
    next_id: int,
) -> tuple[int, int]:
    """Развернуть fractional-строку шаблона в несколько видимых строк."""
    method_name = (calc.research_method.name or "").lower()
    if "конденсат" in method_name:
        frac_rows = _iter_fractional_condensate_rows(calc)
    else:
        frac_rows = _iter_fractional_oil_rows(calc)

    if not frac_rows:
        return (
            _hide_template_row(
                template_sheet,
                current_sheet,
                template_row,
                current_row,
                merged_cells_map,
            ),
            next_id,
        )

    measurement_method = calc.research_method.measurement_method or "-"
    method_name = calc.research_method.name or ""
    group_name = _primary_group_name(calc.research_method)
    written_rows: list[int] = []
    for index, (data_name, unit, result, error) in enumerate(frac_rows):
        copy_row_formatting(
            template_sheet,
            current_sheet,
            template_row,
            current_row,
            merged_cells_map,
        )
        is_first = index == 0
        is_last = index == len(frac_rows) - 1
        method_id = str(next_id) if is_first else ""
        if is_first:
            next_id += 1
        _fill_fractional_placeholders(
            current_sheet,
            current_row,
            method_id=method_id,
            method_name=method_name,
            group_name=group_name,
            data_name=data_name,
            unit=unit,
            result=result,
            error=error,
            measurement_method=measurement_method if method_id else "",
        )
        # Внутри блока фракционного состава убрать лишние горизонтальные линии.
        if is_first:
            _clear_row_horizontal_borders(current_sheet, current_row, clear_bottom=True)
        else:
            _clear_row_horizontal_borders(
                current_sheet,
                current_row,
                clear_top=True,
                clear_bottom=not is_last,
            )
        written_rows.append(current_row)
        current_row += 1

    if written_rows:
        _restore_row_bottom_border_from_template(
            template_sheet,
            current_sheet,
            template_row,
            written_rows[-1],
        )
    return current_row, next_id


def _collect_valid_calculations(samples: list[Sample]) -> list[Calculation]:
    """Собрать расчёты для таблицы методов с фильтрацией по объекту испытаний."""
    test_objects = [sample.test_object for sample in samples if sample.test_object]
    calculations: list[Calculation] = []
    for sample in samples:
        for calc in sample.calculations:
            if calc.deleted_at is None and calc.research_method:
                calculations.append(calc)

    valid_calculations: list[Calculation] = []
    for calc in calculations:
        method_name = calc.research_method.name.lower()
        if "фракционный состав" in method_name and method_name not in [
            "фракционный состав (конденсат)",
            "фракционный состав (нефть)",
        ]:
            continue
        if check_method_name(calc.research_method.name, test_objects):
            valid_calculations.append(calc)

    def get_sort_key(calc):
        method = calc.research_method
        method_name = method.name or ""
        method_sort_order = method.sort_order if method.sort_order is not None else 0
        if method.groups and len(method.groups) > 0:
            group = method.groups[0]
            group_sort_order = group.sort_order if group.sort_order is not None else method_sort_order
            return (group_sort_order, method_sort_order, method_name)
        return (method_sort_order, 0, method_name)

    valid_calculations.sort(key=get_sort_key)
    return valid_calculations


def _condensate_kk_measurement_error(field_value) -> str:
    """Вернуть погрешность для температуры к.к. фракционного состава конденсата."""
    if field_value is None:
        return "±7"
    text = str(field_value).strip().lower()
    if "выше 360" in text:
        return "-"
    try:
        numeric_value = float(str(field_value).replace(",", "."))
        if isinstance(numeric_value, (int, float)) and numeric_value > 360:
            return "-"
    except (ValueError, TypeError):
        pass
    return "±7"


# План колонок таблицы 1 (сохраняется до финального copy_column_dimensions).
_table1_column_plan_ctx: ContextVar["Table1ColumnPlan | None"] = ContextVar("table1_column_plan", default=None)


@dataclass
class IfColBlock:
    """Блок столбцов шаблона с условием {if col}."""

    min_col: int
    max_col: int
    conditions: dict[str, str]
    calc: Calculation | None = None


@dataclass
class LaidOutBlock:
    """Блок метода после упаковки в итоговый лист."""

    source_min: int
    source_max: int
    target_min: int
    target_max: int
    calc: Calculation
    in_width_zone: bool


@dataclass
class Table1ColumnPlan:
    """План столбцов таблицы 1 с {if col}."""

    left_end: int
    blocks: list[LaidOutBlock]
    start_width_col: int | None
    end_width_col: int | None
    last_target_col: int
    last_zone_target_col: int


def get_marker_value_sync(
    protocol: Protocol,
    samples: list[Sample],
    marker: str,
    *,
    sampling_location_name_only: bool = False,
) -> str:
    """Подставить метки синхронно без обращений к HR API."""
    try:
        if marker == "test_protocol_number":
            return str(protocol.test_protocol_number or "").strip()

        if marker == "date_protocol":
            if not protocol.test_protocol_date:
                return ""
            return pendulum.instance(protocol.test_protocol_date).format("DD.MM.YYYY")

        if marker == "abbreviation":
            return _protocol_abbreviation_ctx.get() or ""

        if marker == "accreditation":
            return ""

        if marker == "subd":
            branches = [sample.branch.name for sample in samples if sample.branch and sample.branch.name]
            return join_unique_values(branches)

        if marker == "tel":
            phones = [sample.phone for sample in samples if sample.phone]
            return join_unique_values(phones)

        if marker == "res_object":
            objects = [sample.test_object for sample in samples if sample.test_object]
            return join_unique_values(objects)

        if marker == "sampling_location":
            locations = []
            for sample in samples:
                location_parts = []
                if sample.sampling_location and sample.sampling_location.name:
                    location_parts.append(sample.sampling_location.name.strip())

                if not sampling_location_name_only:
                    well_display = format_well_display(sample.well)
                    if well_display:
                        location_parts.append(well_display)

                    if sample.mode and sample.mode.strip():
                        location_parts.append(sample.mode.strip())

                if location_parts:
                    locations.append(" ".join(location_parts))
            return join_unique_values(locations)

        if marker == "mode":
            modes = [sample.mode.strip() for sample in samples if sample.mode and sample.mode.strip()]
            return join_unique_values(modes)

        if marker == "sampling_date":
            dates = sorted(
                set(
                    pendulum.instance(sample.sampling_date).format("DD.MM.YYYY")
                    for sample in samples
                    if sample.sampling_date
                )
            )
            return ", ".join(dates) if dates else ""

        if marker == "receiving_date":
            dates = sorted(
                set(
                    pendulum.instance(sample.receiving_date).format("DD.MM.YYYY")
                    for sample in samples
                    if sample.receiving_date
                )
            )
            return ", ".join(dates) if dates else ""

        if marker == "laboratory_activity_dates":
            dates = []
            for sample in samples:
                for calc in sample.calculations:
                    if calc.deleted_at is None and calc.laboratory_activity_date:
                        dates.append(calc.laboratory_activity_date)
            if dates:
                min_date = pendulum.instance(min(dates)).format("DD.MM.YYYY")
                max_date = pendulum.instance(max(dates)).format("DD.MM.YYYY")
                return f"{min_date}-{max_date}" if min_date != max_date else min_date
            return ""

        if marker == "lab_location":
            if (
                protocol.department
                and hasattr(protocol.department, "laboratory_location")
                and protocol.department.laboratory_location
            ):
                return protocol.department.laboratory_location
            if (
                protocol.laboratory
                and hasattr(protocol.laboratory, "laboratory_location")
                and protocol.laboratory.laboratory_location
            ):
                return protocol.laboratory.laboratory_location
            return ""

        if marker == "sampling_act_number":
            return protocol.sampling_act_number or ""

        if marker == "registration_number":
            numbers = [sample.registration_number for sample in samples if sample.registration_number]
            return join_unique_values(numbers)

        # Без async HR: только сохранённые должности, имена пустые.
        if marker == "workplace_issued":
            return protocol.issued_position or ""

        if marker == "issued":
            return ""

        if marker == "workplace_approved":
            return protocol.approved_position or ""

        if marker == "approved":
            return ""

        return ""
    except Exception as e:  # noqa: BLE001
        logger.error(f"Ошибка при синхронной подстановке метки {marker}: {e!s}")
        return ""


def _get_merged_col_bounds(sheet, row: int, col: int) -> tuple[int, int]:
    """Вернуть горизонтальные границы объединения, содержащего ячейку."""
    for merged_range in sheet.merged_cells.ranges:
        if merged_range.min_row <= row <= merged_range.max_row and merged_range.min_col <= col <= merged_range.max_col:
            return merged_range.min_col, merged_range.max_col
    return col, col


def _find_table1_bounds(template_sheet, table_start: int) -> tuple[int | None, int | None]:
    """Вернуть строки {start_table1} и {end_table1}."""
    template_last_row, _ = get_template_content_bounds(template_sheet)
    table_data_start = None
    table_data_end = None
    for row_num in range(table_start, template_last_row + 1):
        row = next(iter(template_sheet.iter_rows(min_row=row_num, max_row=row_num, values_only=True)))
        cell_values = [str(cell).strip() for cell in row if cell]
        if table_data_start is None and any(value == "{start_table1}" for value in cell_values):
            table_data_start = row_num
            continue
        if table_data_start is not None and any(value in TABLE1_END_MARKERS for value in cell_values):
            table_data_end = row_num
            break
    if table_data_start is not None and table_data_end is None:
        table_data_end = template_last_row + 1
    return table_data_start, table_data_end


def _table1_uses_column_mode(template_sheet, table_start: int, table_end: int) -> bool:
    """Проверить колоночный режим: внутри table1 есть {if col} или {{start_width}}."""
    _, last_col = get_template_content_bounds(template_sheet)
    for row_num in range(table_start, table_end + 1):
        for col_num in range(1, last_col + 1):
            value = template_sheet.cell(row=row_num, column=col_num).value
            if not value or not isinstance(value, str):
                continue
            if parse_if_col_condition(value) is not None:
                return True
            if START_WIDTH_MARKER in value:
                return True
            # На случай частично повреждённого маркера в шаблоне.
            if "{if col" in value:
                return True
    return False


def _find_width_marker_cols(sheet) -> tuple[int | None, int | None]:
    """Найти столбцы {{start_width}} / {{end_width}} на листе."""
    last_row, last_col = get_template_content_bounds(sheet)
    start_col = None
    end_col = None
    for row_num in range(1, last_row + 1):
        for col_num in range(1, last_col + 1):
            value = sheet.cell(row=row_num, column=col_num).value
            if not value or not isinstance(value, str):
                continue
            if START_WIDTH_MARKER in value and start_col is None:
                start_col = col_num
            if END_WIDTH_MARKER in value and end_col is None:
                end_col = col_num
    return start_col, end_col


def _detect_if_col_blocks(
    template_sheet,
    table_start: int,
    table_end: int,
) -> list[IfColBlock]:
    """Собрать уникальные блоки {if col} слева направо."""
    _, last_col = get_template_content_bounds(template_sheet)
    blocks_by_start: dict[int, IfColBlock] = {}

    for row_num in range(table_start, table_end):
        for col_num in range(1, last_col + 1):
            value = template_sheet.cell(row=row_num, column=col_num).value
            if not value or not isinstance(value, str):
                continue
            conditions = parse_if_col_condition(value)
            if not conditions:
                continue
            min_col, max_col = _get_merged_col_bounds(template_sheet, row_num, col_num)
            existing = blocks_by_start.get(min_col)
            if existing is None or max_col > existing.max_col:
                blocks_by_start[min_col] = IfColBlock(
                    min_col=min_col,
                    max_col=max_col,
                    conditions=conditions,
                )

    return [blocks_by_start[key] for key in sorted(blocks_by_start)]


def _match_if_col_blocks(
    blocks: list[IfColBlock],
    calculations: list[Calculation],
) -> list[IfColBlock]:
    """Оставить блоки с подходящим расчётом; каждый расчёт только один раз."""
    remaining = list(calculations)
    matched: list[IfColBlock] = []
    for block in blocks:
        calc = _find_calculation_for_if_line(block.conditions, remaining)
        if calc is None:
            continue
        remaining = [item for item in remaining if item is not calc]
        matched.append(
            IfColBlock(
                min_col=block.min_col,
                max_col=block.max_col,
                conditions=block.conditions,
                calc=calc,
            )
        )
    return matched


def _row_is_wide_method_banner(
    template_sheet,
    row_num: int,
    plan: Table1ColumnPlan,
) -> bool:
    """
    Проверить, что строка — шапка на всю зону методов (например D23:AC23).

    Не путать со строкой названий методов: там у каждого блока свой текст.
    """
    if not plan.blocks:
        return False
    pack_start = plan.start_width_col if plan.start_width_col is not None else plan.blocks[0].target_min
    first_span = plan.blocks[0].source_max - plan.blocks[0].source_min + 1
    for merged_range in template_sheet.merged_cells.ranges:
        if merged_range.min_row != row_num:
            continue
        if merged_range.min_col > pack_start:
            continue
        if merged_range.max_col < pack_start:
            continue
        # Merge шире двух типичных блоков метода — это общая шапка зоны.
        if merged_range.max_col - merged_range.min_col + 1 > first_span * 2:
            return True
    return False


def _excel_col_width(sheet, col: int) -> float:
    """Вернуть ширину столбца Excel или стандартное значение."""
    letter = get_column_letter(col)
    dim = sheet.column_dimensions.get(letter)
    if dim and dim.width is not None:
        return float(dim.width)
    return 8.43


def _partition_columns_by_equal_width(
    template_sheet,
    start_col: int,
    end_col: int,
    n_groups: int,
) -> list[tuple[int, int]]:
    """
    Разделить столбцы [start_col, end_col) на n_groups групп с близкой суммой ширин.

    Ширины листа не меняет — равная ширина методов получается merge в строках table1.
    """
    if n_groups <= 0 or end_col <= start_col:
        return []

    cols = list(range(start_col, end_col))
    widths = [_excel_col_width(template_sheet, col) for col in cols]
    if n_groups == 1:
        return [(cols[0], cols[-1])]

    if n_groups >= len(cols):
        return [(col, col) for col in cols]

    cumulative: list[float] = []
    running = 0.0
    for width in widths:
        running += width
        cumulative.append(running)
    total = cumulative[-1] or float(len(cols))

    groups: list[tuple[int, int]] = []
    prev_idx = 0
    for group_idx in range(n_groups):
        if group_idx == n_groups - 1:
            groups.append((cols[prev_idx], cols[-1]))
            break

        target_cum = total * (group_idx + 1) / n_groups
        # Минимум 1 столбец на группу; оставить по столбцу на оставшиеся группы.
        max_idx = len(cols) - (n_groups - group_idx - 1) - 1
        min_idx = prev_idx
        best_idx = min_idx
        best_diff = abs(cumulative[min_idx] - target_cum)
        for idx in range(min_idx, max_idx + 1):
            diff = abs(cumulative[idx] - target_cum)
            if diff < best_diff:
                best_diff = diff
                best_idx = idx
        groups.append((cols[prev_idx], cols[best_idx]))
        prev_idx = best_idx + 1
    return groups


def _build_table1_column_plan(
    template_sheet,
    matched_blocks: list[IfColBlock],
) -> Table1ColumnPlan | None:
    """
    Разложить все совпавшие методы в зоне start_width..end_width.

    Столбцы зоны делятся на равные по сумме ширин группы (merge в table1).
    column_dimensions листа не меняются — вне таблицы вид как в шаблоне.
    """
    if not matched_blocks:
        return None

    start_width_col, end_width_col = _find_width_marker_cols(template_sheet)
    first_block_start = min(block.min_col for block in matched_blocks)
    pack_start = start_width_col if start_width_col is not None else first_block_start
    left_end = pack_start - 1

    laid_out: list[LaidOutBlock] = []

    if start_width_col is not None and end_width_col is not None and end_width_col > start_width_col:
        groups = _partition_columns_by_equal_width(
            template_sheet,
            start_width_col,
            end_width_col,
            len(matched_blocks),
        )
        for block, (tgt_min, tgt_max) in zip(matched_blocks, groups, strict=False):
            assert block.calc is not None
            laid_out.append(
                LaidOutBlock(
                    source_min=block.min_col,
                    source_max=block.max_col,
                    target_min=tgt_min,
                    target_max=tgt_max,
                    calc=block.calc,
                    in_width_zone=True,
                )
            )
        # Методов больше, чем столбцов зоны — остаток сразу после end_width.
        cursor = end_width_col
        for block in matched_blocks[len(groups) :]:
            assert block.calc is not None
            span = block.max_col - block.min_col + 1
            laid_out.append(
                LaidOutBlock(
                    source_min=block.min_col,
                    source_max=block.max_col,
                    target_min=cursor,
                    target_max=cursor + span - 1,
                    calc=block.calc,
                    in_width_zone=False,
                )
            )
            cursor += span
        last_zone_target = groups[-1][1] if groups else pack_start - 1
    else:
        cursor = pack_start
        for block in matched_blocks:
            assert block.calc is not None
            span = block.max_col - block.min_col + 1
            laid_out.append(
                LaidOutBlock(
                    source_min=block.min_col,
                    source_max=block.max_col,
                    target_min=cursor,
                    target_max=cursor + span - 1,
                    calc=block.calc,
                    in_width_zone=True,
                )
            )
            cursor += span
        last_zone_target = cursor - 1

    last_target = max((block.target_max for block in laid_out), default=left_end)
    return Table1ColumnPlan(
        left_end=left_end,
        blocks=laid_out,
        start_width_col=start_width_col,
        end_width_col=end_width_col,
        last_target_col=last_target,
        last_zone_target_col=last_zone_target,
    )


def apply_table1_column_widths(
    template_sheet,
    target_sheet,
    plan: Table1ColumnPlan,
) -> None:
    """
    Оставить ширины листа без изменений: вне table1 ячейки совпадают с шаблоном.

    Равная ширина методов достигается раскладкой merge по столбцам зоны,
    а не изменением column_dimensions.
    """
    del template_sheet, target_sheet, plan


async def _load_applicable_nd_norms(
    db: AsyncSession,
    protocol: Protocol,
    samples: list[Sample],
    method_ids: set[int],
) -> list[tuple[NdNorm, dict[int, str]]]:
    """Загрузить нормы НД, применимые к методам протокола."""
    if not method_ids:
        return []

    test_objects = {
        sample.test_object.strip().lower() for sample in samples if sample.test_object and sample.test_object.strip()
    }
    if not test_objects:
        return []

    conditions = [
        NdNorm.deleted_at.is_(None),
        NdNorm.laboratory_id == protocol.laboratory_id,
    ]
    if protocol.department_id:
        conditions.append((NdNorm.department_id == protocol.department_id) | (NdNorm.department_id.is_(None)))

    result = await db.execute(select(NdNorm).where(*conditions).order_by(NdNorm.name))
    applicable: list[tuple[NdNorm, dict[int, str]]] = []
    for norm in result.scalars().all():
        if (norm.test_object or "").strip().lower() not in test_objects:
            continue
        values_by_method: dict[int, str] = {}
        for item in norm.method_data or []:
            method_id = item.get("method_id")
            if method_id in method_ids:
                values_by_method[int(method_id)] = str(item.get("value") or "").strip()
        if values_by_method:
            applicable.append((norm, values_by_method))
    return applicable


def _build_sample_calcs_by_method(sample: Sample) -> dict[int, Calculation]:
    """Построить индекс расчётов пробы по ID метода."""
    return {
        calc.research_method.id: calc
        for calc in sample.calculations
        if calc.deleted_at is None and calc.research_method
    }


def _row_has_if_multiple_samples(template_sheet, row_num: int) -> bool:
    """Проверить, помечена ли строка {if multiple samples line}."""
    _, last_col = get_template_content_bounds(template_sheet)
    for col in range(1, last_col + 1):
        value = template_sheet.cell(row=row_num, column=col).value
        if value and isinstance(value, str) and has_if_multiple_samples_marker(value):
            return True
    return False


def _row_has_norma_markers(template_sheet, row_num: int) -> bool:
    """Проверить, содержит ли строка {norma} или {norma_value}."""
    _, last_col = get_template_content_bounds(template_sheet)
    for col in range(1, last_col + 1):
        value = template_sheet.cell(row=row_num, column=col).value
        if not value or not isinstance(value, str):
            continue
        if "{norma}" in value or "{norma_value}" in value:
            return True
    return False


def _template_row_is_blank(template_sheet, row_num: int) -> bool:
    """Проверить, что в строке шаблона нет значений."""
    _, last_col = get_template_content_bounds(template_sheet)
    for col in range(1, last_col + 1):
        value = template_sheet.cell(row=row_num, column=col).value
        if value is not None and str(value).strip():
            return False
    return True


def _merge_row_span(merged_range) -> int:
    """Вернуть число строк в merge."""
    return merged_range.max_row - merged_range.min_row + 1


def _plan_active_source_cols(plan: Table1ColumnPlan) -> tuple[int, int] | None:
    """Вернуть диапазон исходных столбцов совпавших блоков методов в шаблоне."""
    if not plan.blocks:
        return None
    return (
        min(block.source_min for block in plan.blocks),
        max(block.source_max for block in plan.blocks),
    )


def _merge_overlaps_cols(merged_range, col_min: int, col_max: int) -> bool:
    """Проверить, пересекается ли merge с диапазоном столбцов."""
    return not (merged_range.max_col < col_min or merged_range.min_col > col_max)


def _method_zone_vertical_span(template_sheet, template_row: int, plan: Table1ColumnPlan) -> int:
    """
    Вернуть максимальный vertical span merge на строке в столбцах
    активных блоков методов.

    Левые merge шапки (несколько строк при построчном контенте методов) сюда
    не входят — для них выходные строки по-прежнему идут 1:1 с шаблоном.
    """
    cols = _plan_active_source_cols(plan)
    if cols is None:
        return 1
    col_min, col_max = cols
    span = 1
    for merged_range in template_sheet.merged_cells.ranges:
        if merged_range.min_row != template_row:
            continue
        if not _merge_overlaps_cols(merged_range, col_min, col_max):
            continue
        span = max(span, _merge_row_span(merged_range))
    return span


def _row_is_method_zone_vertical_merge_continuation(
    template_sheet,
    row_num: int,
    plan: Table1ColumnPlan,
    *,
    table_start: int,
    table_end: int,
) -> bool:
    """
    Проверить, что строка — хвост vertical merge в столбцах активных блоков методов.

    Такие строки не пишем отдельно: их занимает span при записи якоря.
    Учитываем только merge с якорем внутри table1 — сквозные служебные
    диапазоны шаблона (например на весь лист) игнорируем.
    """
    cols = _plan_active_source_cols(plan)
    if cols is None:
        return False
    col_min, col_max = cols
    found_slave = False
    for merged_range in template_sheet.merged_cells.ranges:
        if not _merge_overlaps_cols(merged_range, col_min, col_max):
            continue
        if _merge_row_span(merged_range) <= 1:
            continue
        if not (table_start <= merged_range.min_row < table_end):
            continue
        if merged_range.min_row == row_num:
            return False
        if merged_range.min_row < row_num <= merged_range.max_row:
            found_slave = True
    return found_slave


def _source_block_vertical_span(template_sheet, template_row: int, source_min: int, source_max: int) -> int:
    """Вернуть vertical span merge шаблона, пересекающего исходные столбцы блока."""
    span = 1
    for merged_range in template_sheet.merged_cells.ranges:
        if merged_range.min_row != template_row:
            continue
        if merged_range.max_col < source_min or merged_range.min_col > source_max:
            continue
        span = max(span, _merge_row_span(merged_range))
    return span


def _copy_vertical_span_row_heights(
    template_sheet,
    current_sheet,
    template_row: int,
    target_row: int,
    row_span: int,
) -> None:
    """Скопировать высоты строк хвоста vertical merge."""
    for offset in range(1, max(1, row_span)):
        _copy_row_height_only(
            template_sheet,
            current_sheet,
            template_row + offset,
            target_row + offset,
        )


def _border_side_or_none(border, edge: str):
    """Вернуть копию Side границы или None, если линии нет."""
    if not border:
        return None
    side = getattr(border, edge, None)
    if side and side.style:
        return copy(side)
    return None


def _sample_template_merge_edge_sides(
    template_sheet,
    *,
    min_row: int,
    min_col: int,
    max_row: int,
    max_col: int,
) -> dict[str, Any]:
    """
    Собрать стили внешних сторон merge из шаблона.

    Берём первую найденную линию на каждом ребре (как в Excel у объединённых ячеек).
    """
    edges: dict[str, Any] = {
        "left": None,
        "right": None,
        "top": None,
        "bottom": None,
    }
    for row in range(min_row, max_row + 1):
        left = _border_side_or_none(template_sheet.cell(row=row, column=min_col).border, "left")
        right = _border_side_or_none(template_sheet.cell(row=row, column=max_col).border, "right")
        if edges["left"] is None and left is not None:
            edges["left"] = left
        if edges["right"] is None and right is not None:
            edges["right"] = right
    for col in range(min_col, max_col + 1):
        top = _border_side_or_none(template_sheet.cell(row=min_row, column=col).border, "top")
        bottom = _border_side_or_none(template_sheet.cell(row=max_row, column=col).border, "bottom")
        if edges["top"] is None and top is not None:
            edges["top"] = top
        if edges["bottom"] is None and bottom is not None:
            edges["bottom"] = bottom
    return edges


def _paint_range_perimeter_borders(
    current_sheet,
    *,
    min_row: int,
    min_col: int,
    max_row: int,
    max_col: int,
    edges: dict[str, Any],
) -> None:
    """Нарисовать периметр диапазона заданными Side (до merge)."""
    for row in range(min_row, max_row + 1):
        for col in range(min_col, max_col + 1):
            is_left = col == min_col
            is_right = col == max_col
            is_top = row == min_row
            is_bottom = row == max_row
            if not (is_left or is_right or is_top or is_bottom):
                continue
            cell = current_sheet.cell(row=row, column=col)
            new_border = copy(cell.border) if cell.border else Border()
            if is_left and edges.get("left") is not None:
                new_border.left = copy(edges["left"])
            if is_right and edges.get("right") is not None:
                new_border.right = copy(edges["right"])
            if is_top and edges.get("top") is not None:
                new_border.top = copy(edges["top"])
            if is_bottom and edges.get("bottom") is not None:
                new_border.bottom = copy(edges["bottom"])
            cell.border = new_border


def _apply_merged_range_perimeter_borders(
    template_sheet,
    current_sheet,
    *,
    template_min_row: int,
    template_min_col: int,
    template_max_row: int,
    template_max_col: int,
    target_min_row: int,
    target_min_col: int,
    target_max_row: int,
    target_max_col: int,
) -> None:
    """
    Скопировать внешние границы merge из шаблона на крайние ячейки результата.

    При совпадении размера — ячейка в ячейку; при другой ширине блока
    (упаковка start_width/end_width) — только периметр целевого диапазона
    по стилям рёбер шаблона. Вызывать до merged_cells.add.
    """
    template_rows = template_max_row - template_min_row
    template_cols = template_max_col - template_min_col
    target_rows = target_max_row - target_min_row
    target_cols = target_max_col - target_min_col

    if template_rows == target_rows and template_cols == target_cols:
        for row_offset in range(template_rows + 1):
            for col_offset in range(template_cols + 1):
                src = template_sheet.cell(
                    row=template_min_row + row_offset,
                    column=template_min_col + col_offset,
                )
                if not src.border:
                    continue
                tgt = current_sheet.cell(
                    row=target_min_row + row_offset,
                    column=target_min_col + col_offset,
                )
                new_border = copy(tgt.border) if tgt.border else Border()
                src_border = src.border
                if src_border.left and src_border.left.style:
                    new_border.left = copy(src_border.left)
                if src_border.right and src_border.right.style:
                    new_border.right = copy(src_border.right)
                if src_border.top and src_border.top.style:
                    new_border.top = copy(src_border.top)
                if src_border.bottom and src_border.bottom.style:
                    new_border.bottom = copy(src_border.bottom)
                tgt.border = new_border
        return

    edges = _sample_template_merge_edge_sides(
        template_sheet,
        min_row=template_min_row,
        min_col=template_min_col,
        max_row=template_max_row,
        max_col=template_max_col,
    )
    _paint_range_perimeter_borders(
        current_sheet,
        min_row=target_min_row,
        min_col=target_min_col,
        max_row=target_max_row,
        max_col=target_max_col,
        edges=edges,
    )


def _left_merge_anchor(template_sheet, row_num: int, col_num: int) -> tuple[int, int, int, int] | None:
    """
    Вернуть границы merge ячейки или None: (min_row, min_col, max_row, max_col).
    Иначе None.
    """
    for merged_range in template_sheet.merged_cells.ranges:
        if not (
            merged_range.min_row <= row_num <= merged_range.max_row
            and merged_range.min_col <= col_num <= merged_range.max_col
        ):
            continue
        return (
            merged_range.min_row,
            merged_range.min_col,
            merged_range.max_row,
            merged_range.max_col,
        )
    return None


def _resolve_column_cell_value_sync(
    protocol: Protocol,
    samples_for_markers: list[Sample],
    cell_value: str,
    *,
    calc: Calculation | None = None,
    sample_calc: Calculation | None = None,
    norm_name: str | None = None,
    norm_values_by_method: dict[int, str] | None = None,
    sampling_location_name_only: bool = False,
    selection_conditions_templates: list[dict[str, Any]] | None = None,
) -> str:
    """Подставить метки ячейки колоночной таблицы 1."""
    value = strip_table1_structural_markers(cell_value)
    if not value:
        return ""

    method_calc = sample_calc if sample_calc is not None else calc
    method_id = method_calc.research_method.id if method_calc and method_calc.research_method else None

    if "{norma}" in value:
        value = value.replace("{norma}", norm_name or "")
    if "{norma_value}" in value:
        norm_text = ""
        if norm_values_by_method and method_id is not None:
            norm_text = (norm_values_by_method.get(method_id) or "").strip()
        if not norm_text:
            norm_text = "-"
        value = value.replace("{norma_value}", norm_text)

    if "{nd_code}" in value and calc and calc.research_method:
        value = value.replace("{nd_code}", calc.research_method.nd_code or "")
    if ("{nd_name}" in value or "{name_nd}" in value) and calc and calc.research_method:
        nd_name = calc.research_method.nd_name or ""
        value = value.replace("{nd_name}", nd_name).replace("{name_nd}", nd_name)

    if "{name_method}" in value and calc and calc.research_method:
        value = value.replace("{name_method}", calc.research_method.name or "")
    if "{group_name}" in value and calc and calc.research_method:
        value = value.replace("{group_name}", _primary_group_name(calc.research_method))

    if "{unit}" in value:
        if method_calc:
            value = value.replace("{unit}", (method_calc.unit or "").strip() or "-")
        else:
            value = value.replace("{unit}", "")

    if "{measurement_method}" in value and calc and calc.research_method:
        value = value.replace(
            "{measurement_method}",
            calc.research_method.measurement_method or "-",
        )

    if "{result}" in value:
        if method_calc:
            result_text = format_protocol_calculation_result(method_calc)
        elif samples_for_markers:
            result_text = "-"
        else:
            result_text = ""
        value = value.replace("{result}", result_text)

    if "{measurement_error}" in value:
        if method_calc:
            error_text = format_measurement_error_value(method_calc.measurement_error)
            if error_text == "-":
                error_text = ""
        else:
            error_text = ""
        value = value.replace("{measurement_error}", error_text)

    if "{" in value:
        start = 0
        while True:
            start = value.find("{", start)
            if start == -1:
                break
            end = value.find("}", start)
            if end == -1:
                break
            marker = value[start + 1 : end]
            if marker.startswith("sel_cond_") or marker == "bu":
                start = end + 1
                continue
            if marker.startswith("if ") or marker in {
                "start_width",
                "end_width",
                "start_table1",
                "end_table1",
            }:
                start = end + 1
                continue
            marker_value = get_marker_value_sync(
                protocol,
                samples_for_markers,
                marker,
                sampling_location_name_only=sampling_location_name_only,
            )
            value = value.replace(f"{{{marker}}}", marker_value)
            start = end + 1

    if samples_for_markers:
        processed = process_selection_conditions_row(samples_for_markers, value, selection_conditions_templates)
        if processed is None:
            return ""
        return processed

    return value


def _copy_row_height_only(template_sheet, current_sheet, template_row: int, target_row: int) -> None:
    """Скопировать только высоту/hidden строки без подмены RowDimension."""
    copy_row_dimension(template_sheet, current_sheet, template_row, target_row)


def _write_column_table_row(
    protocol: Protocol,
    template_sheet,
    current_sheet,
    template_row: int,
    target_row: int,
    plan: Table1ColumnPlan,
    merged_cells_map,
    *,
    sample: Sample | None = None,
    samples_for_markers: list[Sample] | None = None,
    sample_calcs_by_method: dict[int, Calculation] | None = None,
    norm_name: str | None = None,
    norm_values_by_method: dict[int, str] | None = None,
    sampling_location_name_only: bool = False,
    selection_conditions_templates: list[dict[str, Any]] | None = None,
) -> None:
    """Записать строку колоночной таблицы 1 с упакованными блоками методов."""
    markers_samples = samples_for_markers or ([sample] if sample else [])
    sample_calcs = sample_calcs_by_method or {}

    _copy_row_height_only(template_sheet, current_sheet, template_row, target_row)

    pack_start = (
        plan.start_width_col
        if plan.start_width_col is not None
        else (plan.blocks[0].target_min if plan.blocks else plan.left_end + 1)
    )
    # Шапка и зона методов заканчиваются у end_width (last_zone_target_col).
    last_method_col = plan.last_zone_target_col if plan.last_zone_target_col >= pack_start else plan.last_target_col

    for merged_range in template_sheet.merged_cells.ranges:
        if merged_range.min_row != template_row:
            continue

        # Левые столбцы: горизонтальные и вертикальные merge.
        if merged_range.max_col <= plan.left_end:
            # Пропустить только настоящие 1x1.
            if merged_range.min_row == merged_range.max_row and merged_range.min_col == merged_range.max_col:
                continue
            merge_row_span = _merge_row_span(merged_range)
            _apply_merged_range_perimeter_borders(
                template_sheet,
                current_sheet,
                template_min_row=merged_range.min_row,
                template_min_col=merged_range.min_col,
                template_max_row=merged_range.max_row,
                template_max_col=merged_range.max_col,
                target_min_row=target_row,
                target_min_col=merged_range.min_col,
                target_max_row=target_row + merge_row_span - 1,
                target_max_col=merged_range.max_col,
            )
            new_range = CellRange(
                min_col=merged_range.min_col,
                min_row=target_row,
                max_col=merged_range.max_col,
                max_row=target_row + merge_row_span - 1,
            )
            merged_cells_map.add(new_range)
            continue

        # Широкая шапка методов — накрывает упакованные блоки.
        if (
            plan.blocks
            and merged_range.min_col > plan.left_end
            and merged_range.min_col <= pack_start
            and merged_range.max_col - merged_range.min_col + 1
            > (plan.blocks[0].source_max - plan.blocks[0].source_min + 1)
        ):
            new_range = CellRange(
                min_col=pack_start,
                min_row=target_row,
                max_col=last_method_col,
                max_row=target_row,
            )
            merged_cells_map.add(new_range)
            continue

    for col in range(1, plan.left_end + 1):
        merge_box = _left_merge_anchor(template_sheet, template_row, col)
        # Ячейка-«раб» вертикального/горизонтального merge — не затирать якорь.
        if merge_box is not None:
            min_r, min_c, _max_r, _max_c = merge_box
            if template_row != min_r or col != min_c:
                continue

        src_cell = template_sheet.cell(row=template_row, column=col)
        tgt_cell = current_sheet.cell(row=target_row, column=col)
        tgt_cell.value = src_cell.value
        copy_cell_style(src_cell, tgt_cell)
        if tgt_cell.value and isinstance(tgt_cell.value, str):
            tgt_cell.value = (
                _resolve_column_cell_value_sync(
                    protocol,
                    markers_samples,
                    str(tgt_cell.value),
                    norm_name=norm_name,
                    norm_values_by_method=norm_values_by_method,
                    sampling_location_name_only=sampling_location_name_only,
                    selection_conditions_templates=selection_conditions_templates,
                )
                or None
            )
    # Статическая шапка зоны методов (D23:AC23) — одна ячейка на все блоки.
    if plan.blocks and _row_is_wide_method_banner(template_sheet, template_row, plan):
        banner_value = None
        banner_style_col = pack_start
        scan_end = plan.end_width_col or (plan.blocks[-1].source_max + 1)
        for col in range(pack_start, scan_end):
            raw = template_sheet.cell(row=template_row, column=col).value
            if raw is None:
                continue
            banner_value = raw
            banner_style_col = col
            break
        src_style = template_sheet.cell(row=template_row, column=banner_style_col)
        for col in range(pack_start, last_method_col + 1):
            tgt = current_sheet.cell(row=target_row, column=col)
            tgt.value = None
            copy_cell_style(src_style, tgt)
        anchor = current_sheet.cell(row=target_row, column=pack_start)
        if banner_value and isinstance(banner_value, str):
            anchor.value = (
                _resolve_column_cell_value_sync(
                    protocol,
                    markers_samples,
                    banner_value,
                    norm_name=norm_name,
                    norm_values_by_method=norm_values_by_method,
                    sampling_location_name_only=sampling_location_name_only,
                    selection_conditions_templates=selection_conditions_templates,
                )
                or None
            )
        else:
            anchor.value = banner_value
        if last_method_col > pack_start:
            merged_cells_map.add(
                CellRange(
                    min_col=pack_start,
                    min_row=target_row,
                    max_col=last_method_col,
                    max_row=target_row,
                )
            )
        return

    for block in plan.blocks:
        sample_method_calc = sample_calcs.get(block.calc.research_method.id) if sample else None
        source_span = block.source_max - block.source_min + 1
        target_span = block.target_max - block.target_min + 1
        block_row_span = _source_block_vertical_span(template_sheet, template_row, block.source_min, block.source_max)

        # Ширина блока в столбцах совпала — скопировать блок (в т.ч. со сдвигом).
        if source_span == target_span:
            copy_cell_block(
                template_sheet,
                current_sheet,
                block.source_min,
                block.source_max,
                template_row,
                template_row,
                block.target_min,
                target_row,
                merged_cells_map,
            )
            for offset in range(source_span):
                col = block.target_min + offset
                cell = current_sheet.cell(row=target_row, column=col)
                template_value = template_sheet.cell(row=template_row, column=block.source_min + offset).value
                if not cell.value or not isinstance(cell.value, str):
                    if (
                        offset == 0
                        and template_value
                        and isinstance(template_value, str)
                        and parse_if_col_condition(template_value)
                        and not strip_table1_structural_markers(template_value)
                    ):
                        cell.value = block.calc.research_method.name or ""
                    continue
                resolved = _resolve_column_cell_value_sync(
                    protocol,
                    markers_samples,
                    str(cell.value),
                    calc=block.calc,
                    sample_calc=sample_method_calc,
                    norm_name=norm_name,
                    norm_values_by_method=norm_values_by_method,
                    sampling_location_name_only=sampling_location_name_only,
                    selection_conditions_templates=selection_conditions_templates,
                )
                if (
                    not resolved
                    and template_value
                    and isinstance(template_value, str)
                    and parse_if_col_condition(template_value)
                ):
                    resolved = block.calc.research_method.name or ""
                cell.value = resolved or None
                if template_value and (
                    "{measurement_method}" in str(template_value) or "{nd_code}" in str(template_value)
                ):
                    height_text = (
                        (block.calc.research_method.nd_code or "")
                        if "{nd_code}" in str(template_value)
                        else (block.calc.research_method.measurement_method or "-")
                    )
                    adjust_cell_height_if_needed(
                        current_sheet,
                        target_row,
                        col,
                        height_text,
                    )
            if block_row_span > 1:
                _apply_merged_range_perimeter_borders(
                    template_sheet,
                    current_sheet,
                    template_min_row=template_row,
                    template_min_col=block.source_min,
                    template_max_row=template_row + block_row_span - 1,
                    template_max_col=block.source_max,
                    target_min_row=target_row,
                    target_min_col=block.target_min,
                    target_max_row=target_row + block_row_span - 1,
                    target_max_col=block.target_max,
                )
                merged_cells_map.add(
                    CellRange(
                        min_col=block.target_min,
                        min_row=target_row,
                        max_col=block.target_max,
                        max_row=target_row + block_row_span - 1,
                    )
                )
            continue

        # Зона ширины: целевой диапазон может отличаться от шаблона.
        # Стили брать из исходного блока, значение — в первую ячейку, merge на всю группу.
        src_style_cell = template_sheet.cell(row=template_row, column=block.source_min)
        main_template_value = None
        for src_col in range(block.source_min, block.source_max + 1):
            raw = template_sheet.cell(row=template_row, column=src_col).value
            if raw and isinstance(raw, str) and raw.strip():
                main_template_value = raw
                break
        if main_template_value is None:
            main_template_value = src_style_cell.value

        for tgt_col in range(block.target_min, block.target_max + 1):
            tgt_cell = current_sheet.cell(row=target_row, column=tgt_col)
            tgt_cell.value = None
            copy_cell_style(src_style_cell, tgt_cell)

        resolved = ""
        if main_template_value and isinstance(main_template_value, str):
            resolved = _resolve_column_cell_value_sync(
                protocol,
                markers_samples,
                str(main_template_value),
                calc=block.calc,
                sample_calc=sample_method_calc,
                norm_name=norm_name,
                norm_values_by_method=norm_values_by_method,
                sampling_location_name_only=sampling_location_name_only,
                selection_conditions_templates=selection_conditions_templates,
            )
            if not resolved and parse_if_col_condition(main_template_value):
                resolved = block.calc.research_method.name or ""
        elif main_template_value is not None:
            resolved = str(main_template_value)

        anchor = current_sheet.cell(row=target_row, column=block.target_min)
        anchor.value = resolved or None

        if block.target_max > block.target_min or block_row_span > 1:
            if block_row_span > 1:
                _apply_merged_range_perimeter_borders(
                    template_sheet,
                    current_sheet,
                    template_min_row=template_row,
                    template_min_col=block.source_min,
                    template_max_row=template_row + block_row_span - 1,
                    template_max_col=block.source_max,
                    target_min_row=target_row,
                    target_min_col=block.target_min,
                    target_max_row=target_row + block_row_span - 1,
                    target_max_col=block.target_max,
                )
            merged_cells_map.add(
                CellRange(
                    min_col=block.target_min,
                    min_row=target_row,
                    max_col=block.target_max,
                    max_row=target_row + block_row_span - 1,
                )
            )

        if (
            main_template_value
            and isinstance(main_template_value, str)
            and ("{measurement_method}" in main_template_value or "{nd_code}" in main_template_value)
        ):
            height_text = (
                (block.calc.research_method.nd_code or "")
                if "{nd_code}" in main_template_value
                else (block.calc.research_method.measurement_method or "-")
            )
            adjust_cell_height_if_needed(
                current_sheet,
                target_row,
                block.target_min,
                height_text,
            )


async def process_methods_table_columns(
    protocol: Protocol,
    samples: list[Sample],
    template_sheet,
    new_sheet,
    table_start: int,
    merged_cells_map,
    current_row: int,
    db: AsyncSession,
    selection_conditions_templates: list[dict[str, Any]] | None = None,
    sampling_location_name_only: bool = False,
):
    """
    Обработать колоночную таблицу 1: блоки {if col} упаковать слева направо,
    строки проб/норм размножаются, ширины делятся по бюджету start/end_width.
    """
    current_sheet = new_sheet
    table_data_start, table_data_end = _find_table1_bounds(template_sheet, table_start)
    if table_data_start is None or table_data_end is None:
        return current_sheet

    valid_calculations = _collect_valid_calculations(samples)
    matched_blocks = _match_if_col_blocks(
        _detect_if_col_blocks(template_sheet, table_data_start, table_data_end),
        valid_calculations,
    )
    # Нет подходящих методов — таблицу 1 полностью пропустить.
    if not matched_blocks:
        _table1_column_plan_ctx.set(None)
        return current_sheet

    plan = _build_table1_column_plan(template_sheet, matched_blocks)
    if plan is None:
        _table1_column_plan_ctx.set(None)
        return current_sheet

    _table1_column_plan_ctx.set(plan)
    apply_table1_column_widths(template_sheet, current_sheet, plan)

    method_ids = {block.calc.research_method.id for block in plan.blocks if block.calc.research_method}
    nd_norms = await _load_applicable_nd_norms(db, protocol, samples, method_ids)

    for template_row in range(table_data_start + 1, table_data_end):
        write_kwargs = {
            "sampling_location_name_only": sampling_location_name_only,
            "selection_conditions_templates": selection_conditions_templates,
        }

        # Хвост vertical merge в зоне методов уже занят при записи якоря.
        if _row_is_method_zone_vertical_merge_continuation(
            template_sheet,
            template_row,
            plan,
            table_start=table_data_start,
            table_end=table_data_end,
        ):
            continue

        output_span = _method_zone_vertical_span(template_sheet, template_row, plan)

        # Норма не заполнилась — блок нормы не писать.
        if _row_has_norma_markers(template_sheet, template_row):
            if not nd_norms:
                continue
            for norm, values_by_method in nd_norms:
                _write_column_table_row(
                    protocol,
                    template_sheet,
                    current_sheet,
                    template_row,
                    current_row,
                    plan,
                    merged_cells_map,
                    samples_for_markers=samples,
                    norm_name=norm.name if norm else "",
                    norm_values_by_method=values_by_method,
                    **write_kwargs,
                )
                _copy_vertical_span_row_heights(
                    template_sheet,
                    current_sheet,
                    template_row,
                    current_row,
                    output_span,
                )
                current_row += output_span
            continue

        # Прочие пустые строки шаблона не переносить.
        if _template_row_is_blank(template_sheet, template_row):
            continue

        if _row_has_if_multiple_samples(template_sheet, template_row):
            for sample in samples:
                _write_column_table_row(
                    protocol,
                    template_sheet,
                    current_sheet,
                    template_row,
                    current_row,
                    plan,
                    merged_cells_map,
                    sample=sample,
                    samples_for_markers=[sample],
                    sample_calcs_by_method=_build_sample_calcs_by_method(sample),
                    **write_kwargs,
                )
                _copy_vertical_span_row_heights(
                    template_sheet,
                    current_sheet,
                    template_row,
                    current_row,
                    output_span,
                )
                current_row += output_span
            continue

        _write_column_table_row(
            protocol,
            template_sheet,
            current_sheet,
            template_row,
            current_row,
            plan,
            merged_cells_map,
            samples_for_markers=samples,
            **write_kwargs,
        )
        _copy_vertical_span_row_heights(
            template_sheet,
            current_sheet,
            template_row,
            current_row,
            output_span,
        )
        current_row += output_span

    return current_sheet


async def process_methods_table(
    samples: list[Sample],
    template_sheet,
    new_sheet,
    table_start,
    merged_cells_map,
    current_row,
    selection_conditions_templates: list[dict[str, Any]] | None = None,
    *,
    protocol: Protocol | None = None,
    db: AsyncSession | None = None,
    sampling_location_name_only: bool = False,
):
    """
    Обработать таблицу 1.

    При наличии {if col} или {{start_width}} внутри table1 — колоночный режим,
    иначе прежняя логика строк с {if line}.
    """
    table_data_start, table_data_end = _find_table1_bounds(template_sheet, table_start)
    if table_data_start is None:
        return new_sheet
    if table_data_end is None:
        template_last_row, _ = get_template_content_bounds(template_sheet)
        table_data_end = template_last_row + 1

    if _table1_uses_column_mode(template_sheet, table_data_start, table_data_end):
        if protocol is None or db is None:
            return new_sheet
        return await process_methods_table_columns(
            protocol,
            samples,
            template_sheet,
            new_sheet,
            table_start,
            merged_cells_map,
            current_row,
            db,
            selection_conditions_templates,
            sampling_location_name_only,
        )

    _table1_column_plan_ctx.set(None)
    del selection_conditions_templates  # метки таблицы 1 не используют условия отбора
    current_sheet = new_sheet
    valid_calculations = _collect_valid_calculations(samples)

    next_id = 1
    last_visible_output_row: int | None = None
    hidden_since_last_visible: list[int] = []

    for template_row in range(table_data_start + 1, table_data_end):
        row_values = [
            template_sheet.cell(row=template_row, column=col).value
            for col in range(1, _scan_row_max_col(template_sheet, template_row) + 1)
        ]
        row_text = " ".join(str(v) for v in row_values if v)

        conditions = None
        for value in row_values:
            if value and isinstance(value, str):
                conditions = parse_if_line_condition(value)
                if conditions is not None:
                    break

        if conditions is None:
            copy_row_formatting(
                template_sheet,
                current_sheet,
                template_row,
                current_row,
                merged_cells_map,
            )
            last_visible_output_row = current_row
            hidden_since_last_visible = []
            current_row += 1
            continue

        calc = _find_calculation_for_if_line(conditions, valid_calculations)
        if calc is None:
            hidden_since_last_visible.append(template_row)
            current_row = _hide_template_row(
                template_sheet,
                current_sheet,
                template_row,
                current_row,
                merged_cells_map,
            )
            continue

        has_id_marker = "{id_method}" in row_text
        if has_id_marker:
            _close_previous_visible_row_before_id_method(
                template_sheet,
                current_sheet,
                next_template_row=template_row,
                last_visible_output_row=last_visible_output_row,
                hidden_template_rows=hidden_since_last_visible,
            )

        if _row_has_fractional_markers(template_sheet, template_row):
            start_output_row = current_row
            current_row, next_id = _expand_fractional_if_line_row(
                calc,
                template_sheet,
                current_sheet,
                template_row,
                current_row,
                merged_cells_map,
                next_id,
            )
            if current_row > start_output_row:
                last_visible_output_row = current_row - 1
                hidden_since_last_visible = []
            continue

        copy_row_formatting(
            template_sheet,
            current_sheet,
            template_row,
            current_row,
            merged_cells_map,
        )
        method_id = str(next_id) if has_id_marker else None
        if has_id_marker:
            next_id += 1
        _fill_method_row_placeholders(
            current_sheet,
            current_row,
            method_id=method_id,
            calc=calc,
        )
        last_visible_output_row = current_row
        hidden_since_last_visible = []
        current_row += 1

    return current_sheet


def _collect_equipment_ids_from_samples(samples: list[Sample]) -> set[int]:
    """Собрать уникальные ID оборудования из поля calculation.equipment_data для всех проб."""
    equipment_ids: set[int] = set()

    for sample in samples:
        for calc in getattr(sample, "calculations", []) or []:
            if calc.deleted_at is not None:
                continue
            data = getattr(calc, "equipment_data", None)
            if not data:
                continue

            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and "id" in item:
                        try:
                            equipment_ids.add(int(item["id"]))
                        except (TypeError, ValueError):
                            continue
                    elif isinstance(item, (int, str)):
                        try:
                            equipment_ids.add(int(item))
                        except (TypeError, ValueError):
                            continue
            elif isinstance(data, dict) and "id" in data:
                try:
                    equipment_ids.add(int(data["id"]))
                except (TypeError, ValueError):
                    continue
            elif isinstance(data, (int, str)):
                try:
                    equipment_ids.add(int(data))
                except (TypeError, ValueError):
                    continue

    return equipment_ids


def process_equipment_table(
    equipment_list: list[Equipment],
    template_sheet,
    current_sheet,
    table_start,
    merged_cells_map,
    current_row,
):
    """Обработать таблицу с оборудованием."""
    seen_equipment = set()
    unique_equipment = []

    for equipment in equipment_list:
        ver_date = None
        if equipment.verification_date:
            verification_dt = ensure_datetime(equipment.verification_date)
            ver_date = verification_dt.format("YYYY-MM-DD") if verification_dt else str(equipment.verification_date)

        ver_end_date = None
        if equipment.verification_end_date:
            verification_end_dt = ensure_datetime(equipment.verification_end_date)
            ver_end_date = (
                verification_end_dt.format("YYYY-MM-DD")
                if verification_end_dt
                else str(equipment.verification_end_date)
            )

        equipment_key = (
            equipment.name or "",
            equipment.serial_number or "",
            equipment.verification_info or "",
            ver_date,
            ver_end_date,
        )

        if equipment_key not in seen_equipment:
            seen_equipment.add(equipment_key)
            unique_equipment.append(equipment)

    # Сортировать список оборудования по наименованию и версии.
    equipment_list = sorted(unique_equipment, key=lambda x: (x.name or "", x.version or ""))

    if not equipment_list:
        return current_sheet

    template_last_row, _ = get_template_content_bounds(template_sheet)
    start_marker_row = None
    template_row_num = None

    for row_num in range(table_start, template_last_row + 1):
        row = next(iter(template_sheet.iter_rows(min_row=row_num, max_row=row_num, values_only=True)))
        if any(cell and str(cell).strip() == "{start_table2}" for cell in row):
            start_marker_row = row_num
            template_row_num = row_num + 1
            break

    if start_marker_row is None or not template_row_num:
        return current_sheet

    if template_row_num > template_last_row:
        return current_sheet
    end_check = template_sheet.cell(row=template_row_num, column=1).value
    if end_check and str(end_check).strip() == "{end_table2}":
        return current_sheet

    idx = 1
    for equipment in equipment_list:
        copy_row_formatting(
            template_sheet,
            current_sheet,
            template_row_num,
            current_row,
            merged_cells_map,
        )

        for col in range(1, _scan_row_max_col(template_sheet, template_row_num) + 1):
            cell = current_sheet.cell(row=current_row, column=col)
            if not cell.value:
                continue

            value = str(cell.value)
            if "{id_equipment}" in value:
                cell.value = value.replace("{id_equipment}", str(idx))
            elif "{name_equipment}" in value:
                equipment_name = equipment.name or ""
                cell.value = value.replace("{name_equipment}", equipment_name)
                adjust_cell_height_if_needed(current_sheet, current_row, col, equipment_name)
            elif "{serial_num}" in value:
                cell.value = value.replace("{serial_num}", equipment.serial_number or "")
            elif "{ver_info}" in value:
                verification_info = equipment.verification_info or ""
                cell.value = value.replace("{ver_info}", verification_info)
                adjust_cell_height_if_needed(current_sheet, current_row, col, verification_info)
            elif "{ver_date}" in value:
                if equipment.verification_date:
                    formatted_date = pendulum.instance(equipment.verification_date).format("DD.MM.YYYY")
                    cell.value = value.replace("{ver_date}", formatted_date)
                else:
                    cell.value = value.replace("{ver_date}", "")
            elif "{ver_end_date}" in value:
                if equipment.verification_end_date:
                    formatted_date = pendulum.instance(equipment.verification_end_date).format("DD.MM.YYYY")
                    cell.value = value.replace("{ver_end_date}", formatted_date)
                else:
                    cell.value = value.replace("{ver_end_date}", "")

        current_row += 1
        idx += 1

    return current_sheet


def process_nd_table(
    samples: list[Sample],
    template_sheet,
    current_sheet,
    table_start,
    merged_cells_map,
    current_row,
):
    """Обработать таблицу с нормативными документами."""
    calculations = []
    for sample in samples:
        for calc in sample.calculations:
            if calc.deleted_at is None and calc.research_method:
                calculations.append(calc)

    test_objects = []
    for sample in samples:
        if sample.test_object:
            test_objects.append(sample.test_object)

    valid_calculations = [calc for calc in calculations if check_method_name(calc.research_method.name, test_objects)]

    def get_sort_key(calc):
        method = calc.research_method
        method_name = method.name or ""
        method_sort_order = method.sort_order if method.sort_order is not None else 0
        if method.groups and len(method.groups) > 0:
            group = method.groups[0]
            group_sort_order = group.sort_order if group.sort_order is not None else method_sort_order
            return (group_sort_order, method_sort_order, method_name)
        return (method_sort_order, 0, method_name)

    valid_calculations.sort(key=get_sort_key)

    nd_list = []
    seen_nd = set()
    for calc in valid_calculations:
        nd_code = calc.research_method.nd_code or ""
        nd_name = calc.research_method.nd_name or ""
        nd_key = (nd_code, nd_name)
        if nd_key not in seen_nd and (nd_code or nd_name):
            seen_nd.add(nd_key)
            nd_list.append(nd_key)

    if not nd_list:
        return current_sheet

    template_last_row, _ = get_template_content_bounds(template_sheet)
    start_marker_row = None
    template_row_num = None

    for row_num in range(table_start, template_last_row + 1):
        row = next(iter(template_sheet.iter_rows(min_row=row_num, max_row=row_num, values_only=True)))
        if any(cell and str(cell).strip() == "{start_table3}" for cell in row):
            start_marker_row = row_num
            template_row_num = row_num + 1
            break

    if start_marker_row is None or not template_row_num:
        return current_sheet

    if template_row_num > template_last_row:
        return current_sheet
    end_check = template_sheet.cell(row=template_row_num, column=1).value
    if end_check and str(end_check).strip() == "{end_table3}":
        return current_sheet

    idx = 1
    for nd_code, nd_name in nd_list:
        copy_row_formatting(
            template_sheet,
            current_sheet,
            template_row_num,
            current_row,
            merged_cells_map,
        )

        for col in range(1, _scan_row_max_col(template_sheet, template_row_num) + 1):
            cell = current_sheet.cell(row=current_row, column=col)
            if not cell.value:
                continue

            value = str(cell.value)
            if "{id_nd}" in value:
                cell.value = value.replace("{id_nd}", str(idx))
            elif "{nd_code}" in value:
                cell.value = value.replace("{nd_code}", nd_code)
            elif "{name_nd}" in value:
                cell.value = value.replace("{name_nd}", nd_name)
                adjust_cell_height_if_needed(current_sheet, current_row, col, nd_name)

        current_row += 1
        idx += 1

    return current_sheet


async def generate_protocol_excel(db: AsyncSession, protocol_id: int) -> tuple[bytes, str]:
    """Сгенерировать Excel-файл протокола и вернуть содержимое с именем файла."""
    try:
        _table1_column_plan_ctx.set(None)
        query = (
            select(Protocol)
            .where(Protocol.id == protocol_id)
            .options(
                selectinload(Protocol.laboratory),
                selectinload(Protocol.department),
                selectinload(Protocol.protocol_template),
            )
        )
        result = await db.execute(query)
        protocol = result.scalar_one_or_none()

        if not protocol:
            raise NotFoundError(f"Протокол с id {protocol_id} не найден")

        if not protocol.protocol_template:
            raise DomainValidationError("У протокола отсутствует шаблон Excel")

        sample_ids = protocol.samples or []
        if not sample_ids:
            raise DomainValidationError("У протокола отсутствуют пробы")

        samples_query = (
            select(Sample)
            .where(Sample.id.in_(sample_ids))
            .where(Sample.deleted_at.is_(None))
            .options(
                selectinload(Sample.branch),
                selectinload(Sample.sampling_location),
                selectinload(Sample.calculations)
                .selectinload(Calculation.research_method)
                .selectinload(ResearchMethod.groups),
            )
        )
        samples_result = await db.execute(samples_query)
        samples = list(samples_result.scalars().all())

        if not samples:
            raise DomainValidationError("У протокола отсутствуют пробы")

        # Загрузить шаблоны условий отбора для лаборатории/подразделения.
        selection_conditions_templates = []
        if protocol.laboratory_id or protocol.department_id:
            selection_conditions_query = select(SelectionConditions).where(SelectionConditions.deleted_at.is_(None))
            if protocol.laboratory_id:
                selection_conditions_query = selection_conditions_query.where(
                    SelectionConditions.laboratory_id == protocol.laboratory_id
                )
            if protocol.department_id:
                selection_conditions_query = selection_conditions_query.where(
                    SelectionConditions.department_id == protocol.department_id
                )
            selection_conditions_result = await db.execute(selection_conditions_query)
            selection_conditions_list = list(selection_conditions_result.scalars().all())
            if selection_conditions_list:
                selection_conditions_templates = [{"conditions": sc.conditions} for sc in selection_conditions_list]

        # Собрать список используемого оборудования для всех расчётов по пробам.
        equipment_ids = _collect_equipment_ids_from_samples(samples)
        equipment_list: list[Equipment] = []
        if equipment_ids:
            equipment_query = select(Equipment).where(Equipment.id.in_(equipment_ids))
            equipment_result = await db.execute(equipment_query)
            equipment_list = list(equipment_result.scalars().all())

        abbreviations_by_name = await get_protocol_abbreviations_by_names(
            db,
            [sample.test_object for sample in samples if sample.test_object],
        )
        protocol_abbreviation = pick_first_protocol_abbreviation(
            abbreviations_by_name,
            [sample.test_object for sample in samples],
        )
        _protocol_abbreviation_ctx.set(protocol_abbreviation)

        file_data = protocol.protocol_template.file
        try:
            template_bytes = BytesIO(base64.b64decode(file_data))
        except Exception:  # noqa: BLE001
            try:
                with open(file_data, "rb") as f:
                    template_bytes = BytesIO(f.read())
            except Exception:  # noqa: BLE001
                template_bytes = BytesIO(file_data.encode() if isinstance(file_data, str) else file_data)

        template_workbook = openpyxl.load_workbook(template_bytes)
        template_sheet = require_worksheet(template_workbook)
        sampling_location_name_only = template_contains_marker(template_sheet, "{mode}")
        template_last_row, template_last_col = get_template_content_bounds(template_sheet)
        # Убрать «хвост» пустых стилизованных ячеек шаблона (до EM) —
        # иначе max_column раздувает весь протокол.
        purge_sheet_cells_beyond(template_sheet, template_last_row, template_last_col)

        new_workbook = openpyxl.Workbook()
        new_sheet = require_worksheet(new_workbook)
        new_sheet.title = "Лист 1"
        copy_sheet_page_settings(template_sheet, new_sheet)

        for footer_attr in ("oddFooter", "evenFooter", "firstFooter"):
            if not hasattr(template_sheet, footer_attr) or not hasattr(new_sheet, footer_attr):
                continue
            template_footer = getattr(template_sheet, footer_attr)
            new_footer = getattr(new_sheet, footer_attr)
            if template_footer is None or new_footer is None:
                continue
            for part_attr in ("left", "center", "right"):
                template_part = getattr(template_footer, part_attr, None)
                if template_part is not None:
                    setattr(
                        new_footer,
                        part_attr,
                        await process_footer_test_protocol_number(protocol, samples, template_part),
                    )

        merged_cells_map = new_sheet.merged_cells

        header_end = await process_header(
            protocol,
            samples,
            template_sheet,
            new_sheet,
            merged_cells_map,
            selection_conditions_templates,
            sampling_location_name_only,
        )
        if header_end == 0:
            raise DomainValidationError("Ошибка при обработке шапки протокола")

        table_start = await process_header_and_conditions(
            protocol,
            samples,
            template_sheet,
            new_sheet,
            header_end,
            merged_cells_map,
            selection_conditions_templates,
            sampling_location_name_only,
        )

        current_sheet = await process_methods_table(
            samples,
            template_sheet,
            new_sheet,
            table_start,
            merged_cells_map,
            new_sheet.max_row + 1,
            selection_conditions_templates,
            protocol=protocol,
            db=db,
            sampling_location_name_only=sampling_location_name_only,
        )
        if not current_sheet:
            raise DomainValidationError("Ошибка при обработке таблицы методов")

        current_row = new_sheet.max_row + 1
        table1_end = None
        for row_num in range(table_start, template_last_row + 1):
            row = next(iter(template_sheet.iter_rows(min_row=row_num, max_row=row_num, values_only=True)))
            if any(cell and str(cell).strip() in TABLE1_END_MARKERS for cell in row):
                table1_end = row_num
                break

        if table1_end:
            current_sheet, current_row = await process_between_tables(
                protocol,
                samples,
                template_sheet,
                current_sheet,
                table1_end,
                merged_cells_map,
                current_sheet.max_row + 1,
                selection_conditions_templates,
                sampling_location_name_only,
            )

            current_sheet = process_equipment_table(
                equipment_list,
                template_sheet,
                current_sheet,
                table1_end + 1,
                merged_cells_map,
                current_row,
            )
            if not current_sheet:
                raise DomainValidationError("Ошибка при обработке таблицы оборудования")

            table2_end = None
            for row_num in range(table1_end + 1, template_last_row + 1):
                row = next(iter(template_sheet.iter_rows(min_row=row_num, max_row=row_num, values_only=True)))
                if any(cell and str(cell).strip() == "{end_table2}" for cell in row):
                    table2_end = row_num
                    break

            if table2_end:
                current_sheet, current_row = await process_between_tables(
                    protocol,
                    samples,
                    template_sheet,
                    current_sheet,
                    table2_end,
                    merged_cells_map,
                    current_sheet.max_row + 1,
                    selection_conditions_templates,
                    sampling_location_name_only,
                )

                current_sheet = process_nd_table(
                    samples,
                    template_sheet,
                    current_sheet,
                    table2_end + 1,
                    merged_cells_map,
                    current_row,
                )
                if not current_sheet:
                    raise DomainValidationError("Ошибка при обработке таблицы НД")

                table3_end = None
                for row_num in range(table2_end + 1, template_last_row + 1):
                    row = next(iter(template_sheet.iter_rows(min_row=row_num, max_row=row_num, values_only=True)))
                    if any(cell and str(cell).strip() == "{end_table3}" for cell in row):
                        table3_end = row_num
                        break

                if table3_end:
                    current_sheet = await process_footer(
                        protocol,
                        samples,
                        template_sheet,
                        current_sheet,
                        table3_end,
                        merged_cells_map,
                        current_sheet.max_row + 1,
                        selection_conditions_templates,
                        sampling_location_name_only,
                    )

        copy_sheet_page_settings(template_sheet, new_sheet)
        copy_column_dimensions(template_sheet, new_sheet)
        # Ширины колоночного режима применить после общего копирования из шаблона.
        column_plan = _table1_column_plan_ctx.get()
        if column_plan is not None:
            apply_table1_column_widths(template_sheet, new_sheet, column_plan)

        apply_sheet_print_area(new_sheet)

        output = BytesIO()
        new_workbook.save(output)
        output.seek(0)

        # Сформировать имя файла: "Протокол_<Номер протокола>.xlsx".
        protocol_number = None
        if protocol.test_protocol_number:
            protocol_number_str = str(protocol.test_protocol_number).strip()
            if protocol_number_str:
                protocol_number = protocol_number_str

        # Если номера протокола нет — использовать ID протокола.
        if not protocol_number:
            protocol_number = str(protocol_id)
            logger.warning(f"Номер протокола отсутствует для протокола {protocol_id}, используется ID")

        clean_protocol_number = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "_", protocol_number)
        clean_protocol_number = clean_protocol_number.replace(" ", "_")
        filename_ru = f"Протокол_{clean_protocol_number}.xlsx"
        return output.getvalue(), filename_ru

    except (NotFoundError, DomainValidationError):
        raise
    except Exception as e:
        logger.error(f"Ошибка при генерации протокола: {e!s}")
        raise DomainValidationError(f"Ошибка при генерации протокола: {e!s}") from e
