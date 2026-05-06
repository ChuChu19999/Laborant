import base64
import re
from copy import copy
from io import BytesIO
from typing import Any, Dict, List, Optional
from urllib.parse import quote
import openpyxl
import orjson
import pendulum
from fastapi import HTTPException, status
from fastapi.responses import Response
from openpyxl.worksheet.header_footer import _HeaderFooterPart
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from core.exceptions import NotFoundError, ValidationError
from core.logger import logger
from models.calculation import Calculation
from models.equipment import Equipment
from models.protocol import Protocol, ProtocolTemplate
from models.research import ResearchMethod, ResearchMethodGroup
from models.sample import Sample, SelectionConditions
from services.employees import (
    get_employee_position_and_name,
    get_employees_by_hashes,
)
from utils.protocol_generator_utils import (
    adjust_cell_height_if_needed,
    check_method_name,
    copy_cell_style,
    copy_column_dimensions,
    copy_row_formatting,
    copy_row_with_styles,
    format_decimal_ru,
    map_test_object_to_suffix,
)

_CM_TO_INCH = 2.54


def set_sheet_margins(sheet):
    """Устанавливает фиксированные поля страницы на листе Excel."""
    sheet.page_margins.left = 1.5 / _CM_TO_INCH
    sheet.page_margins.right = 1.0 / _CM_TO_INCH
    sheet.page_margins.top = 1.1 / _CM_TO_INCH
    sheet.page_margins.bottom = 0.9 / _CM_TO_INCH


def enforce_fit_to_page(sheet):
    """Устанавливает подгонку по ширине страницы и включает fitToPage."""
    sheet.page_setup.fitToWidth = 1
    sheet.page_setup.fitToHeight = 0
    sheet.page_setup.fitToPage = True


async def process_cell_markers(
    protocol: Protocol,
    samples: List[Sample],
    cell_value: str,
    selection_conditions_templates: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """Обрабатывает все метки в ячейке."""
    if not cell_value or not isinstance(cell_value, str):
        return cell_value

    if "{" not in cell_value:
        return cell_value

    try:
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
            if not marker.startswith("sel_cond_") and not marker == "bu":
                value = await get_marker_value_title(protocol, samples, marker)
                result = result.replace(f"{{{marker}}}", value)

            start = end + 1

        processed_result = process_selection_conditions_row(
            samples, result, selection_conditions_templates
        )
        if processed_result is None:
            return "HIDE_ROW"
        return processed_result

    except Exception as e:
        logger.error(f"Ошибка при обработке меток в ячейке: {str(e)}")
        return cell_value


async def get_marker_value_title(
    protocol: Protocol, samples: List[Sample], marker: str
) -> str:
    """Возвращает значение для метки в заголовке протокола."""
    try:
        if marker == "test_protocol_number":
            if not protocol.test_protocol_number:
                return ""

            base_number = protocol.test_protocol_number

            if protocol.is_accredited:
                suffix = ""
                for sample in samples:
                    suffix = map_test_object_to_suffix(sample.test_object)
                    if suffix:
                        break

                base_number = (
                    f"{protocol.test_protocol_number}/07/{suffix}"
                    if suffix
                    else f"{protocol.test_protocol_number}/07"
                )

            if protocol.test_protocol_date:
                date_str = pendulum.instance(protocol.test_protocol_date).format(
                    "DD.MM.YYYY"
                )
                return f"{base_number} от {date_str}"
            return base_number

        elif marker == "subd":
            branches = [
                sample.branch.name
                for sample in samples
                if sample.branch and sample.branch.name
            ]
            return ", ".join(set(branches)) if branches else ""

        elif marker == "tel":
            phones = [sample.phone for sample in samples if sample.phone]
            return ", ".join(set(phones)) if phones else ""

        elif marker == "res_object":
            objects = [sample.test_object for sample in samples if sample.test_object]
            return ", ".join(objects) if objects else ""

        elif marker == "sampling_location":
            locations = []
            for sample in samples:
                location_parts = []
                if sample.sampling_location and sample.sampling_location.name:
                    location_parts.append(sample.sampling_location.name.strip())

                if sample.well and sample.well.strip():
                    well_value = sample.well.strip()
                    if re.match(r"^\d", well_value):
                        well_value = f"скв. {well_value}"
                    location_parts.append(well_value)

                if sample.mode and sample.mode.strip():
                    location_parts.append(sample.mode.strip())

                if location_parts:
                    locations.append(" ".join(location_parts))
            return ", ".join(locations) if locations else ""

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
            numbers = [
                sample.registration_number
                for sample in samples
                if sample.registration_number
            ]
            return ", ".join(numbers) if numbers else ""

        elif marker == "workplace_issued":
            if protocol.issued_position:
                return protocol.issued_position
            elif protocol.issued:
                target_date = protocol.test_protocol_date or protocol.created_at
                if isinstance(target_date, str):
                    target_date = pendulum.parse(target_date)
                elif hasattr(target_date, "date"):
                    target_date = target_date.date()
                position, _ = await get_employee_position_and_name(
                    protocol.issued, target_date
                )
                return position
            return ""

        elif marker == "issued":
            if protocol.issued:
                target_date = protocol.test_protocol_date or protocol.created_at
                if isinstance(target_date, str):
                    target_date = pendulum.parse(target_date)
                elif hasattr(target_date, "date"):
                    target_date = target_date.date()
                _, formatted_name = await get_employee_position_and_name(
                    protocol.issued, target_date
                )
                return formatted_name
            return ""

        elif marker == "workplace_approved":
            if protocol.approved_position:
                return protocol.approved_position
            elif protocol.approved:
                target_date = protocol.test_protocol_date or protocol.created_at
                if isinstance(target_date, str):
                    target_date = pendulum.parse(target_date)
                elif hasattr(target_date, "date"):
                    target_date = target_date.date()
                position, _ = await get_employee_position_and_name(
                    protocol.approved, target_date
                )
                return position
            return ""

        elif marker == "approved":
            if protocol.approved:
                target_date = protocol.test_protocol_date or protocol.created_at
                if isinstance(target_date, str):
                    target_date = pendulum.parse(target_date)
                elif hasattr(target_date, "date"):
                    target_date = target_date.date()
                _, formatted_name = await get_employee_position_and_name(
                    protocol.approved, target_date
                )
                return formatted_name
            return ""

        return ""
    except Exception as e:
        logger.error(f"Ошибка при получении значения для метки {marker}: {str(e)}")
        return ""


def process_selection_conditions_row(
    samples: List[Sample],
    cell_value: str,
    selection_conditions_templates: Optional[List[Dict[str, Any]]] = None,
) -> Optional[str]:
    """Обрабатывает метки условий отбора в ячейке."""
    if not cell_value or not isinstance(cell_value, str):
        return cell_value

    if "{sel_cond_" not in cell_value and "{bu}" not in cell_value:
        return cell_value

    # Создаем словарь для поиска единиц измерения по названию переменной
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

        # Поддержка формата, когда условия хранятся в виде
        # {"conditions": [ ... ]}
        if isinstance(sample_conditions, dict) and "conditions" in sample_conditions:
            sample_conditions = sample_conditions.get("conditions") or []

        # Поддержка формата, когда условия хранятся в виде
        # {"Давление": "4.33", "Температура": "-6", ...}
        # где ключ - это название переменной, значение - это значение
        # Единицы измерения берутся из шаблонов SelectionConditions
        if (
            isinstance(sample_conditions, dict)
            and "conditions" not in sample_conditions
        ):
            for variable, value in sample_conditions.items():
                if variable and value and str(value).strip() != "":
                    formatted_value = str(value).replace(".", ",")
                    # Ищем единицу измерения в шаблонах по названию переменной
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

        tags_for_index = re.findall(
            r"\{sel_cond_([^}]+)_" + str(current_index) + r"\}", result
        )
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
    samples: List[Sample],
    template_sheet,
    new_sheet,
    merged_cells_map,
    selection_conditions_templates: Optional[List[Dict[str, Any]]] = None,
):
    """Обрабатывает шапку протокола."""
    current_row_new = 1
    found_start = False

    for current_row in range(1, template_sheet.max_row + 1):
        row = list(
            template_sheet.iter_rows(
                min_row=current_row, max_row=current_row, values_only=True
            )
        )[0]

        if not found_start:
            if any(cell and str(cell).strip() == "{{start_header}}" for cell in row):
                found_start = True
            continue

        if any(cell and str(cell).strip() == "{{end_header}}" for cell in row):
            return current_row + 1

        if (
            not protocol.is_accredited
            and protocol.protocol_template
            and current_row == protocol.protocol_template.accreditation_header_row
        ):
            continue

        if current_row in template_sheet.row_dimensions:
            new_sheet.row_dimensions[current_row_new] = copy(
                template_sheet.row_dimensions[current_row]
            )

        for merged_range in template_sheet.merged_cells.ranges:
            if merged_range.min_row == current_row:
                new_range = openpyxl.worksheet.cell_range.CellRange(
                    min_col=merged_range.min_col,
                    min_row=current_row_new,
                    max_col=merged_range.max_col,
                    max_row=current_row_new
                    + (merged_range.max_row - merged_range.min_row),
                )
                merged_cells_map.add(new_range)

        copy_row_with_styles(template_sheet, new_sheet, current_row, current_row_new)

        skip_row = False
        for col in range(1, template_sheet.max_column + 1):
            cell = new_sheet.cell(row=current_row_new, column=col)
            if cell.value:
                processed_value = await process_cell_markers(
                    protocol, samples, str(cell.value), selection_conditions_templates
                )
                if processed_value == "HIDE_ROW":
                    skip_row = True
                    break
                elif processed_value is not None:
                    cell.value = processed_value

        if skip_row:
            new_sheet.row_dimensions[current_row_new].hidden = True
            continue

        current_row_new += 1

    return current_row


async def process_header_and_conditions(
    protocol: Protocol,
    samples: List[Sample],
    template_sheet,
    new_sheet,
    start_row,
    merged_cells_map,
    selection_conditions_templates: Optional[List[Dict[str, Any]]] = None,
):
    """Обрабатывает заголовок и условия отбора после шапки до начала таблицы."""
    current_row_new = new_sheet.max_row + 1

    for current_row in range(start_row, template_sheet.max_row + 1):
        row = list(
            template_sheet.iter_rows(
                min_row=current_row, max_row=current_row, values_only=True
            )
        )[0]

        if any(cell and str(cell).strip() == "{{start_table1}}" for cell in row):
            return current_row

        skip_row = False
        processed_values = []

        for cell_value in row:
            if cell_value:
                processed_value = await process_cell_markers(
                    protocol, samples, str(cell_value), selection_conditions_templates
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

        if current_row in template_sheet.row_dimensions:
            new_sheet.row_dimensions[current_row_new] = copy(
                template_sheet.row_dimensions[current_row]
            )

        for merged_range in template_sheet.merged_cells.ranges:
            if merged_range.min_row == current_row:
                new_range = openpyxl.worksheet.cell_range.CellRange(
                    min_col=merged_range.min_col,
                    min_row=current_row_new,
                    max_col=merged_range.max_col,
                    max_row=current_row_new
                    + (merged_range.max_row - merged_range.min_row),
                )
                merged_cells_map.add(new_range)

        copy_row_with_styles(template_sheet, new_sheet, current_row, current_row_new)

        for col, processed_value in enumerate(processed_values, start=1):
            if processed_value is not None:
                cell = new_sheet.cell(row=current_row_new, column=col)
                cell.value = processed_value

        current_row_new += 1

    return current_row


async def process_footer_test_protocol_number(
    protocol: Protocol, samples: List[Sample], text
) -> _HeaderFooterPart:
    """Заменяет только {test_protocol_number} на значение из get_marker_value_title в тексте колонтитула."""
    orig_text = text
    if hasattr(text, "text"):
        text = text.text
    if not text or not isinstance(text, str):
        return orig_text
    value = await get_marker_value_title(protocol, samples, "test_protocol_number")
    result = text.replace("{test_protocol_number}", value)

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
    samples: List[Sample],
    template_sheet,
    current_sheet,
    footer_start,
    merged_cells_map,
    current_row,
    selection_conditions_templates: Optional[List[Dict[str, Any]]] = None,
):
    """Обрабатывает оставшиеся строки после последней таблицы (подвал протокола)."""
    sheet_merged_cells_map = current_sheet.merged_cells

    for row_num in range(footer_start + 1, template_sheet.max_row + 1):
        row = list(
            template_sheet.iter_rows(min_row=row_num, max_row=row_num, values_only=True)
        )[0]
        if any(
            cell
            and str(cell).strip()
            in [
                "{end_table1}",
                "{end_table2}",
                "{end_table3}",
                "{{end_table1}}",
                "{{end_table2}}",
                "{{end_table3}}",
            ]
            for cell in row
        ):
            continue

        if row_num in template_sheet.row_dimensions:
            current_sheet.row_dimensions[current_row] = copy(
                template_sheet.row_dimensions[row_num]
            )

        for merged_range in template_sheet.merged_cells.ranges:
            if merged_range.min_row == row_num:
                new_range = openpyxl.worksheet.cell_range.CellRange(
                    min_col=merged_range.min_col,
                    min_row=current_row,
                    max_col=merged_range.max_col,
                    max_row=current_row + (merged_range.max_row - merged_range.min_row),
                )
                sheet_merged_cells_map.add(new_range)

        for col in range(1, template_sheet.max_column + 1):
            source_cell = template_sheet.cell(row=row_num, column=col)
            target_cell = current_sheet.cell(row=current_row, column=col)

            target_cell.value = source_cell.value
            copy_cell_style(source_cell, target_cell)

        for col in range(1, template_sheet.max_column + 1):
            cell = current_sheet.cell(row=current_row, column=col)
            if cell.value:
                processed_value = await process_cell_markers(
                    protocol, samples, str(cell.value), selection_conditions_templates
                )
                if processed_value is not None:
                    cell.value = processed_value

        current_row += 1

    return current_sheet


async def process_between_tables(
    protocol: Protocol,
    samples: List[Sample],
    template_sheet,
    current_sheet,
    table_end,
    merged_cells_map,
    current_row,
    selection_conditions_templates: Optional[List[Dict[str, Any]]] = None,
):
    """Обрабатывает данные между таблицами."""
    sheet_merged_cells_map = current_sheet.merged_cells

    next_table_start = None
    for row_num in range(table_end + 1, template_sheet.max_row + 1):
        row = list(
            template_sheet.iter_rows(min_row=row_num, max_row=row_num, values_only=True)
        )[0]
        if any(cell and str(cell).strip().startswith("{{start_table") for cell in row):
            next_table_start = row_num
            break

    if not next_table_start:
        return current_sheet, current_row

    executors_cache = set()
    target_date = protocol.test_protocol_date or protocol.created_at
    if hasattr(target_date, "date"):
        target_date = target_date.date()
    elif isinstance(target_date, str):
        target_date = pendulum.parse(target_date).date()

    # Собираем все уникальные hashMd5 исполнителей
    unique_executors = set()
    for sample in samples:
        for calc in sample.calculations:
            if calc.deleted_at is None and calc.executor:
                unique_executors.add(calc.executor)

    # Делаем батч-запрос для получения базовой информации о всех исполнителях
    # Это оптимизирует запросы, но для получения позиции на конкретную дату
    # все равно нужно вызывать get_employee_position_and_name (который использует кэш)
    employees_data = {}
    if unique_executors:
        try:
            employees_data = await get_employees_by_hashes(
                list(unique_executors), include_photo=False
            )
        except Exception as e:
            logger.warning(f"Ошибка при батч-запросе сотрудников: {e}")

    # Для каждого уникального исполнителя получаем позицию и имя
    # get_employee_position_and_name использует кэш, поэтому повторные вызовы
    # для одного и того же исполнителя будут быстрыми
    for executor_hash in unique_executors:
        position, formatted_name = await get_employee_position_and_name(
            executor_hash, target_date
        )
        if formatted_name:
            logger.info(
                f"Из HR API получили: ФИО={formatted_name}, должность={position or ''}"
            )
            # Преобразуем должность в нижний регистр
            position_lower = position.lower() if position else ""
            executor_info = (
                f"{position_lower} {formatted_name}".strip()
                if position_lower
                else formatted_name
            )
            executors_cache.add(executor_info)

    executors = sorted(executors_cache) if executors_cache else []

    row_with_executor = None
    executor_column = None

    for row_num in range(table_end + 1, next_table_start):
        row = list(
            template_sheet.iter_rows(min_row=row_num, max_row=row_num, values_only=True)
        )[0]

        if any(
            cell
            and str(cell).strip()
            in [
                "{end_table1}",
                "{end_table2}",
                "{end_table3}",
                "{{end_table1}}",
                "{{end_table2}}",
                "{{end_table3}}",
            ]
            for cell in row
        ):
            continue

        for col_idx, cell_value in enumerate(row, 1):
            if cell_value and "{executor}" in str(cell_value):
                row_with_executor = row_num
                executor_column = col_idx
                break

        if row_with_executor:
            break

    for row_num in range(table_end + 1, next_table_start):
        row = list(
            template_sheet.iter_rows(min_row=row_num, max_row=row_num, values_only=True)
        )[0]

        if any(
            cell
            and str(cell).strip()
            in [
                "{end_table1}",
                "{end_table2}",
                "{end_table3}",
                "{{end_table1}}",
                "{{end_table2}}",
                "{{end_table3}}",
            ]
            for cell in row
        ):
            continue

        copy_row_formatting(
            template_sheet, current_sheet, row_num, current_row, sheet_merged_cells_map
        )

        if row_num == row_with_executor and executors and executor_column:
            for col in range(1, template_sheet.max_column + 1):
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
                    sheet_merged_cells_map,
                )

                for col in range(1, template_sheet.max_column + 1):
                    cell = current_sheet.cell(row=current_row, column=col)
                    if cell.value:
                        if col == executor_column and "{executor}" in str(cell.value):
                            cell.value = str(cell.value).replace("{executor}", executor)
                        else:
                            cell.value = ""

                current_row += 1
        else:
            for col in range(1, template_sheet.max_column + 1):
                cell = current_sheet.cell(row=current_row, column=col)
                if cell.value:
                    processed_value = await process_cell_markers(
                        protocol,
                        samples,
                        str(cell.value),
                        selection_conditions_templates,
                    )
                    if processed_value is not None:
                        cell.value = processed_value

            current_row += 1

    return current_sheet, current_row


def add_standalone_method(
    calc,
    current_row,
    current_sheet,
    template_sheet,
    table_header_start,
    table_header_end,
    template_row_num,
    merged_cells_map,
    idx,
):
    """Добавляет одиночный метод в таблицу."""
    sheet_merged_cells_map = current_sheet.merged_cells

    copy_row_formatting(
        template_sheet,
        current_sheet,
        template_row_num,
        current_row,
        sheet_merged_cells_map,
    )

    for col in range(1, template_sheet.max_column + 1):
        cell = current_sheet.cell(row=current_row, column=col)
        if not cell.value:
            continue

        value = str(cell.value)
        if "{id_method}" in value:
            cell.value = value.replace("{id_method}", str(idx))
        elif "{name_method}" in value:
            method_name = calc.research_method.name
            cell.value = value.replace("{name_method}", method_name)
        elif "{unit}" in value:
            cell.value = value.replace("{unit}", calc.unit or "-")
        elif "{result}" in value:
            cell.value = value.replace("{result}", format_decimal_ru(calc.result))
        elif "{measurement_error}" in value:
            error_value = calc.measurement_error
            formatted_error = (
                error_value
                if error_value and error_value.startswith("-")
                else (f"±{error_value}" if error_value and error_value != "-" else "-")
            )
            cell.value = value.replace("{measurement_error}", formatted_error)
        elif "{measurement_method}" in value:
            measurement_method = calc.research_method.measurement_method or "-"
            cell.value = value.replace("{measurement_method}", measurement_method)
            adjust_cell_height_if_needed(
                current_sheet, current_row, col, measurement_method
            )

    return current_row + 1, current_sheet


def add_group_methods(
    group_data,
    current_row,
    current_sheet,
    template_sheet,
    table_header_start,
    table_header_end,
    template_row_num,
    merged_cells_map,
    idx,
):
    """Добавляет группу методов в таблицу."""
    sheet_merged_cells_map = current_sheet.merged_cells

    measurement_methods = set(
        method.measurement_method for method in group_data["methods"]
    )
    units = set(calc.unit for calc in group_data["calculations"])

    common_measurement_method = (
        next(iter(measurement_methods)) if len(measurement_methods) == 1 else None
    )
    common_unit = next(iter(units)) if len(units) == 1 else None

    copy_row_formatting(
        template_sheet,
        current_sheet,
        template_row_num,
        current_row,
        sheet_merged_cells_map,
    )

    group_name = group_data["name"]
    matching_calc = None
    for calc in group_data["calculations"]:
        if calc.research_method.name == group_name:
            matching_calc = calc
            break

    for col in range(1, template_sheet.max_column + 1):
        cell = current_sheet.cell(row=current_row, column=col)

        if cell.border:
            new_border = copy(cell.border)
            new_border.bottom = None
            cell.border = new_border

        if not cell.value:
            continue

        value = str(cell.value)
        if "{id_method}" in value:
            cell.value = value.replace("{id_method}", str(idx))
        elif "{name_method}" in value:
            cell.value = value.replace("{name_method}", group_name)
        elif "{unit}" in value:
            cell.value = value.replace("{unit}", common_unit or "-")
        elif "{measurement_method}" in value:
            measurement_method = common_measurement_method or "-"
            cell.value = value.replace("{measurement_method}", measurement_method)
            adjust_cell_height_if_needed(
                current_sheet, current_row, col, measurement_method
            )
        elif "{result}" in value:
            if matching_calc:
                cell.value = value.replace(
                    "{result}", format_decimal_ru(matching_calc.result)
                )
            else:
                cell.value = value.replace("{result}", "")
        elif "{measurement_error}" in value:
            if matching_calc:
                error_value = matching_calc.measurement_error
                formatted_error = (
                    error_value
                    if error_value and error_value.startswith("-")
                    else (
                        f"±{error_value}" if error_value and error_value != "-" else "-"
                    )
                )
                cell.value = value.replace("{measurement_error}", formatted_error)
            else:
                cell.value = value.replace("{measurement_error}", "")

    current_row += 1

    for i, calc in enumerate(group_data["calculations"]):
        if calc.research_method.name == group_name:
            continue
        copy_row_formatting(
            template_sheet,
            current_sheet,
            template_row_num,
            current_row,
            sheet_merged_cells_map,
        )

        last_method_in_group = i == len(group_data["calculations"]) - 1
        for col in range(1, template_sheet.max_column + 1):
            cell = current_sheet.cell(row=current_row, column=col)
            if cell.border:
                new_border = copy(cell.border)
                new_border.top = None

                if not last_method_in_group:
                    new_border.bottom = None
                cell.border = new_border

        for col in range(1, template_sheet.max_column + 1):
            cell = current_sheet.cell(row=current_row, column=col)
            if not cell.value:
                continue

            value = str(cell.value)
            if "{id_method}" in value:
                cell.value = ""
            elif "{name_method}" in value:
                method_name = calc.research_method.name
                group_name = group_data["name"]
                if method_name and (
                    "нефть" in method_name.lower()
                    or "конденсат" in method_name.lower()
                    or method_name == group_name
                ):
                    cell.value = ""
                elif method_name:
                    method_name = method_name[0].lower() + method_name[1:]
                    cell.value = method_name
                else:
                    cell.value = ""
            elif "{result}" in value:
                cell.value = value.replace("{result}", format_decimal_ru(calc.result))
            elif "{measurement_error}" in value:
                error_value = calc.measurement_error
                formatted_error = (
                    error_value
                    if error_value and error_value.startswith("-")
                    else (
                        f"±{error_value}" if error_value and error_value != "-" else "-"
                    )
                )
                cell.value = value.replace("{measurement_error}", formatted_error)
            elif "{unit}" in value:
                cell.value = ""
            elif "{measurement_method}" in value:
                cell.value = ""

        current_row += 1

    return current_row, current_sheet


def process_fractional_composition_oil(
    calc,
    current_row,
    current_sheet,
    template_sheet,
    table_header_start,
    table_header_end,
    template_row_num,
    merged_cells_map,
    idx,
):
    """Обрабатывает фракционный состав нефти для таблицы 1."""

    try:
        if hasattr(calc, "intermediate_data") and calc.intermediate_data:
            if isinstance(calc.intermediate_data, str):
                result_data = orjson.loads(calc.intermediate_data)
            else:
                result_data = calc.intermediate_data
        else:
            if isinstance(calc.result, str):
                result_data = orjson.loads(calc.result)
            else:
                result_data = calc.result

        if isinstance(result_data, dict) and "_fractional_data" in result_data:
            fractional_data = result_data["_fractional_data"]
            combined_data = {}
            for card_key, card_data in fractional_data.items():
                if isinstance(card_data, dict):
                    for field, value in card_data.items():
                        if (
                            field not in combined_data
                            or combined_data[field] is None
                            or combined_data[field] == ""
                        ):
                            combined_data[field] = value

            result_data = combined_data

        # Нормализуем ключи: заменяем запятую на точку в "Температура н,к."
        if isinstance(result_data, dict):
            normalized_data = {}
            for key, value in result_data.items():
                normalized_key = key.replace("Температура н,к.", "Температура н.к.")
                normalized_data[normalized_key] = value
            result_data = normalized_data

    except (orjson.JSONDecodeError, TypeError) as e:
        logger.error(
            f"Не удалось распарсить результат для фракционного состава нефти: {str(e)}"
        )
        return current_row, current_sheet

    fractional_fields = [
        "Температура н.к.",
        "Выход фракций до 100 ℃",
        "Выход фракций до 150 ℃",
        "Выход фракций до 200 ℃",
        "Выход фракций до 250 ℃",
        "Выход фракций до 270 ℃",
        "Выход фракций до 300 ℃",
    ]

    error_map = {
        "Температура н.к.": "±5",
        "Выход фракций до 100 ℃": "±1,4",
        "Выход фракций до 150 ℃": "±1,4",
        "Выход фракций до 200 ℃": "±1,4",
        "Выход фракций до 250 ℃": "±1,4",
        "Выход фракций до 270 ℃": "±1,4",
        "Выход фракций до 300 ℃": "±1,4",
    }

    sheet_merged_cells_map = current_sheet.merged_cells

    copy_row_formatting(
        template_sheet,
        current_sheet,
        template_row_num,
        current_row,
        sheet_merged_cells_map,
    )

    for col in range(1, template_sheet.max_column + 1):
        cell = current_sheet.cell(row=current_row, column=col)
        if not cell.value:
            continue

        value = str(cell.value)
        if "{id_method}" in value:
            cell.value = value.replace("{id_method}", str(idx))
        elif "{name_method}" in value:
            cell.value = value.replace("{name_method}", "Фракционный состав:")
        elif "{unit}" in value:
            cell.value = value.replace("{unit}", "")
        elif "{measurement_method}" in value:
            measurement_method = calc.research_method.measurement_method or "-"
            cell.value = value.replace("{measurement_method}", measurement_method)
        else:
            for placeholder in ["{result}", "{measurement_error}"]:
                if placeholder in value:
                    cell.value = value.replace(placeholder, "")

    for col in range(1, template_sheet.max_column + 1):
        cell = current_sheet.cell(row=current_row, column=col)
        if cell.border:
            new_border = copy(cell.border)
            new_border.bottom = None
            cell.border = new_border

    current_row += 1

    fractional_output_header_done = False

    for i, field in enumerate(fractional_fields):
        # Проверяем оба варианта ключа (с точкой и с запятой)
        field_value = result_data.get(field, "")
        if not field_value or field_value == "-":
            # Пробуем вариант с запятой для "Температура н.к."
            if field == "Температура н.к.":
                field_value = result_data.get("Температура н,к.", "")

        if field_value is None or field_value == "" or field_value == "-":
            continue

        is_output_fraction_field = "Выход фракций до" in field
        if is_output_fraction_field and not fractional_output_header_done:
            # Строка-заголовок: "Выход фракций до температуры: %"
            copy_row_formatting(
                template_sheet,
                current_sheet,
                template_row_num,
                current_row,
                sheet_merged_cells_map,
            )
            for col in range(1, template_sheet.max_column + 1):
                cell = current_sheet.cell(row=current_row, column=col)
                if not cell.value:
                    continue
                value = str(cell.value)
                if "{id_method}" in value:
                    cell.value = ""
                elif "{name_method}" in value:
                    cell.value = "Выход фракций до температуры:"
                elif "{unit}" in value:
                    cell.value = "%"
                elif "{result}" in value or "{measurement_error}" in value:
                    cell.value = value.replace("{result}", "").replace(
                        "{measurement_error}", ""
                    )
                elif "{measurement_method}" in value:
                    cell.value = ""
            for col in range(1, template_sheet.max_column + 1):
                cell = current_sheet.cell(row=current_row, column=col)
                if cell.border:
                    new_border = copy(cell.border)
                    new_border.top = None
                    new_border.bottom = None
                    cell.border = new_border
            current_row += 1
            fractional_output_header_done = True

        copy_row_formatting(
            template_sheet,
            current_sheet,
            template_row_num,
            current_row,
            sheet_merged_cells_map,
        )

        for col in range(1, template_sheet.max_column + 1):
            cell = current_sheet.cell(row=current_row, column=col)
            if not cell.value:
                continue

            value = str(cell.value)
            if "{id_method}" in value:
                cell.value = ""
            elif "{name_method}" in value:
                field_name = field
                if field_name:
                    if (
                        "℃" in field_name
                        or "температура" in field_name.lower()
                        or "% отгона" in field_name
                    ):
                        field_name = field_name[0].upper() + field_name[1:]

                    if "Выход фракций до" in field_name:
                        temp_match = (
                            field_name.split("до ")[1]
                            if "до " in field_name
                            else field_name
                        )
                        field_name = temp_match

                    cell.value = field_name
            elif "{result}" in value:
                if "температура" in field.lower() or "% отгона" in field:
                    try:
                        numeric_value = (
                            float(field_value)
                            if isinstance(field_value, str)
                            else field_value
                        )
                        if (
                            isinstance(numeric_value, (int, float))
                            and numeric_value > 360
                        ):
                            cell.value = "выше 360"
                        else:
                            cell.value = str(field_value).replace(".", ",")
                    except (ValueError, TypeError):
                        cell.value = str(field_value).replace(".", ",")
                else:
                    cell.value = str(field_value).replace(".", ",")
            elif "{measurement_error}" in value:
                error_value = error_map.get(field, "-")
                cell.value = error_value
            elif "{unit}" in value:
                if field == "Температура н.к.":
                    cell.value = "°C"
                elif (
                    field == "10% отгона при температуре"
                    or field == "50% отгона при температуре"
                ):
                    cell.value = "°C"
                elif "Выход фракций до" in field:
                    cell.value = ""
                else:
                    cell.value = ""
            elif "{measurement_method}" in value:
                cell.value = ""

        for col in range(1, template_sheet.max_column + 1):
            cell = current_sheet.cell(row=current_row, column=col)
            if cell.border:
                new_border = copy(cell.border)
                new_border.top = None
                new_border.bottom = None
                cell.border = new_border

        current_row += 1

    return current_row, current_sheet


def process_fractional_composition_condensate(
    calc,
    current_row,
    current_sheet,
    template_sheet,
    table_header_start,
    table_header_end,
    template_row_num,
    merged_cells_map,
    idx,
):
    """Обрабатывает фракционный состав конденсата для таблицы 1."""

    try:
        if isinstance(calc.result, str):
            result_data = orjson.loads(calc.result)
        else:
            result_data = calc.result
    except (orjson.JSONDecodeError, TypeError) as e:
        logger.error(
            f"Не удалось распарсить результат для фракционного состава: {str(e)}"
        )
        return current_row, current_sheet

    if isinstance(result_data, dict):
        normalized_data = {}
        for key, value in result_data.items():
            normalized_key = key.strip() if isinstance(key, str) else key
            if isinstance(normalized_key, str):
                if normalized_key.lower().startswith("температура н"):
                    normalized_key = "Температура н.к."
                else:
                    normalized_key = normalized_key.replace(
                        "Температура н,к.", "Температура н.к."
                    )
            normalized_data[normalized_key] = value
        result_data = normalized_data

    fractional_fields = [
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
        "96% отгона при температуре",
        "98% отгона при температуре",
        "Температура к.к.",
        "Объемная доля отгона",
        "Объемная доля остатка",
        "Объемная доля потерь",
    ]

    error_map = {
        "Температура н.к.": "±5",
        "5% отгона при температуре": "-",
        "10% отгона при температуре": "±4",
        "20% отгона при температуре": "-",
        "30% отгона при температуре": "-",
        "40% отгона при температуре": "-",
        "50% отгона при температуре": "±2",
        "60% отгона при температуре": "-",
        "70% отгона при температуре": "-",
        "80% отгона при температуре": "-",
        "90% отгона при температуре": "±5",
        "95% отгона при температуре": "-",
        "96% отгона при температуре": "-",
        "98% отгона при температуре": "-",
        "Температура к.к.": "-",
        "Объемная доля отгона": "-",
        "Объемная доля остатка": "±0,3",
        "Объемная доля потерь": "-",
    }

    sheet_merged_cells_map = current_sheet.merged_cells

    copy_row_formatting(
        template_sheet,
        current_sheet,
        template_row_num,
        current_row,
        sheet_merged_cells_map,
    )

    for col in range(1, template_sheet.max_column + 1):
        cell = current_sheet.cell(row=current_row, column=col)
        if not cell.value:
            continue

        value = str(cell.value)
        if "{id_method}" in value:
            cell.value = value.replace("{id_method}", str(idx))
        elif "{name_method}" in value:
            cell.value = value.replace("{name_method}", "Фракционный состав:")
        elif "{unit}" in value:
            cell.value = value.replace("{unit}", "")
        elif "{measurement_method}" in value:
            measurement_method = calc.research_method.measurement_method or "-"
            cell.value = value.replace("{measurement_method}", measurement_method)
        else:
            for placeholder in ["{result}", "{measurement_error}"]:
                if placeholder in value:
                    cell.value = value.replace(placeholder, "")

    for col in range(1, template_sheet.max_column + 1):
        cell = current_sheet.cell(row=current_row, column=col)
        if cell.border:
            new_border = copy(cell.border)
            new_border.bottom = None
            cell.border = new_border

    current_row += 1

    for i, field in enumerate(fractional_fields):
        field_value = result_data.get(field, "")

        if field_value is None or field_value == "" or field_value == "-":
            continue

        copy_row_formatting(
            template_sheet,
            current_sheet,
            template_row_num,
            current_row,
            sheet_merged_cells_map,
        )

        for col in range(1, template_sheet.max_column + 1):
            cell = current_sheet.cell(row=current_row, column=col)
            if not cell.value:
                continue

            value = str(cell.value)
            if "{id_method}" in value:
                cell.value = ""
            elif "{name_method}" in value:
                field_name = field
                if field_name:
                    if "% отгона при температуре" in field_name:
                        is_first_percent_field = not any(
                            "% отгона при температуре" in prev_field
                            for prev_field in fractional_fields[:i]
                            if result_data.get(prev_field) not in [None, "", "-"]
                        )
                        if is_first_percent_field:
                            field_name = field_name[0].upper() + field_name[1:]
                        else:
                            field_name = field_name.split("%")[0] + "%"
                    else:
                        field_name = field_name[0].upper() + field_name[1:]
                    cell.value = field_name
            elif "{result}" in value:
                if (
                    "температура" in field.lower()
                    or "% отгона при температуре" in field
                ):
                    try:
                        numeric_value = (
                            float(field_value)
                            if isinstance(field_value, str)
                            else field_value
                        )
                        if (
                            isinstance(numeric_value, (int, float))
                            and numeric_value > 360
                        ):
                            cell.value = "выше 360"
                        else:
                            cell.value = str(field_value).replace(".", ",")
                    except (ValueError, TypeError):
                        cell.value = str(field_value).replace(".", ",")
                else:
                    cell.value = str(field_value).replace(".", ",")
            elif "{measurement_error}" in value:
                error_value = error_map.get(field, "-")
                cell.value = error_value
            elif "{unit}" in value:
                if "температура" in field.lower():
                    cell.value = "°C"
                elif "% отгона при температуре" in field:
                    is_first_percent_field = not any(
                        "% отгона при температуре" in prev_field
                        for prev_field in fractional_fields[:i]
                        if result_data.get(prev_field) not in [None, "", "-"]
                    )
                    if is_first_percent_field:
                        cell.value = "°C"
                    else:
                        cell.value = ""
                elif "доля" in field.lower():
                    cell.value = "%"
                else:
                    cell.value = ""
            elif "{measurement_method}" in value:
                cell.value = ""

        for col in range(1, template_sheet.max_column + 1):
            cell = current_sheet.cell(row=current_row, column=col)
            if cell.border:
                new_border = copy(cell.border)
                new_border.top = None
                new_border.bottom = None
                cell.border = new_border

        current_row += 1

    return current_row, current_sheet


def process_methods_table(
    protocol: Protocol,
    samples: List[Sample],
    template_sheet,
    new_sheet,
    table_start,
    merged_cells_map,
    current_row,
):
    """Обрабатывает таблицу с методами исследования."""
    current_sheet = new_sheet

    test_objects = []
    for sample in samples:
        if sample.test_object:
            test_objects.append(sample.test_object)

    calculations = []
    for sample in samples:
        for calc in sample.calculations:
            if calc.deleted_at is None and calc.research_method:
                calculations.append(calc)

    valid_calculations = []
    for calc in calculations:
        method_name = calc.research_method.name.lower()
        if "фракционный состав" in method_name and method_name not in [
            "фракционный состав (конденсат)",
            "фракционный состав (нефть)",
        ]:
            continue

        if check_method_name(calc.research_method.name, test_objects):
            valid_calculations.append(calc)

    if not valid_calculations:
        return current_sheet

    # Сортируем расчеты как на странице расчётов: sort_order, затем имя.
    # Для группы с sort_order=None используем sort_order метода, чтобы не ставить блок в начало.
    def get_sort_key(calc):
        method = calc.research_method
        method_name = method.name or ""
        method_sort_order = method.sort_order if method.sort_order is not None else 0
        if method.groups and len(method.groups) > 0:
            group = method.groups[0]
            group_sort_order = (
                group.sort_order if group.sort_order is not None else method_sort_order
            )
            return (group_sort_order, method_sort_order, method_name)
        return (method_sort_order, 0, method_name)

    valid_calculations.sort(key=get_sort_key)

    table_header_start = None
    table_header_end = None

    for row_num in range(table_start, template_sheet.max_row + 1):
        row = list(
            template_sheet.iter_rows(min_row=row_num, max_row=row_num, values_only=True)
        )[0]

        for cell in row:
            if cell:
                cell_str = str(cell).strip()
                if table_header_start is None and cell_str == "{{start_table1}}":
                    table_header_start = row_num
                    break
                elif table_header_start is not None and cell_str == "{start_table1}":
                    table_header_end = row_num
                    break

    if table_header_start is None:
        return current_sheet

    if table_header_end is None:
        table_header_end = table_header_start + 1

    template_row_num = None

    for row_num in range(table_header_end, template_sheet.max_row + 1):
        row = list(
            template_sheet.iter_rows(min_row=row_num, max_row=row_num, values_only=True)
        )[0]

        if any(cell and str(cell).strip() == "{start_table1}" for cell in row):
            template_row_num = row_num + 1
            break
        elif any(cell and str(cell).strip() == "{end_table1}" for cell in row):
            break

    if not template_row_num:
        return current_sheet

    grouped_calculations = {}
    processed_calculations = []

    for calc in valid_calculations:
        if calc.research_method.name.lower() == "фракционный состав (конденсат)":
            processed_calculations.append(
                {"type": "fractional_condensate", "calc": calc}
            )
        elif calc.research_method.name.lower() == "фракционный состав (нефть)":
            processed_calculations.append({"type": "fractional_oil", "calc": calc})
        elif calc.research_method.is_group_member and calc.research_method.groups:
            group = (
                calc.research_method.groups[0] if calc.research_method.groups else None
            )
            if group:
                group_id = group.id
                group_name = group.name

                if group_id not in grouped_calculations:
                    grouped_calculations[group_id] = {
                        "name": group_name,
                        "calculations": [],
                        "methods": [],
                    }

                grouped_calculations[group_id]["calculations"].append(calc)
                grouped_calculations[group_id]["methods"].append(calc.research_method)
                processed_calculations.append(
                    {"type": "group", "group_id": group_id, "calc": calc}
                )
        else:
            processed_calculations.append({"type": "standalone", "calc": calc})

    def _item_desc(it):
        if it["type"] == "fractional_condensate":
            return f"fractional_condensate {it['calc'].research_method.name!r}"
        if it["type"] == "fractional_oil":
            return f"fractional_oil {it['calc'].research_method.name!r}"
        if it["type"] == "group":
            g = grouped_calculations.get(it["group_id"], {})
            return f"group {g.get('name')!r} method={it['calc'].research_method.name!r}"
        return f"standalone {it['calc'].research_method.name!r}"

    # Сортируем методы внутри каждой группы как в API: sort_order (0 при None), затем имя.
    for group_id, group_data in grouped_calculations.items():
        group_data["calculations"].sort(
            key=lambda calc: (
                (
                    calc.research_method.sort_order
                    if calc.research_method.sort_order is not None
                    else 0
                ),
                (calc.research_method.name or ""),
            )
        )
        group_data["methods"].sort(
            key=lambda method: (
                method.sort_order if method.sort_order is not None else 0,
                method.name or "",
            )
        )

    # Заголовок таблицы копируем один раз в начало, чтобы порядок блоков совпадал с processed_calculations.
    row_before_header = current_row
    for row_num in range(table_header_start + 1, table_header_end):
        copy_row_formatting(
            template_sheet,
            current_sheet,
            row_num,
            current_row,
            merged_cells_map,
        )
        current_row += 1

    idx = 1
    current_group = None
    group_methods = []

    for i, item in enumerate(processed_calculations):
        row_start = current_row
        if item["type"] == "fractional_condensate":
            if group_methods:
                group_id = current_group
                group_data = grouped_calculations[group_id]
                has_special_methods = any(
                    "нефть" in method.name.lower() or "конденсат" in method.name.lower()
                    for method in group_data["methods"]
                )
                if has_special_methods:
                    group_calc = copy(group_data["calculations"][0])
                    original_name = group_calc.research_method.name
                    group_calc.research_method.name = group_data["name"]
                    current_row, current_sheet = add_standalone_method(
                        group_calc,
                        current_row,
                        current_sheet,
                        template_sheet,
                        table_header_start,
                        table_header_end,
                        template_row_num,
                        merged_cells_map,
                        idx,
                    )
                    group_calc.research_method.name = original_name
                else:
                    current_row, current_sheet = add_group_methods(
                        group_data,
                        current_row,
                        current_sheet,
                        template_sheet,
                        table_header_start,
                        table_header_end,
                        template_row_num,
                        merged_cells_map,
                        idx,
                    )
                idx += 1
                group_methods = []
                current_group = None
            current_row, current_sheet = process_fractional_composition_condensate(
                item["calc"],
                current_row,
                current_sheet,
                template_sheet,
                table_header_start,
                table_header_end,
                template_row_num,
                merged_cells_map,
                idx,
            )
            idx += 1
        elif item["type"] == "fractional_oil":
            if group_methods:
                group_id = current_group
                group_data = grouped_calculations[group_id]
                has_special_methods = any(
                    "нефть" in method.name.lower() or "конденсат" in method.name.lower()
                    for method in group_data["methods"]
                )
                if has_special_methods:
                    group_calc = copy(group_data["calculations"][0])
                    original_name = group_calc.research_method.name
                    group_calc.research_method.name = group_data["name"]
                    current_row, current_sheet = add_standalone_method(
                        group_calc,
                        current_row,
                        current_sheet,
                        template_sheet,
                        table_header_start,
                        table_header_end,
                        template_row_num,
                        merged_cells_map,
                        idx,
                    )
                    group_calc.research_method.name = original_name
                else:
                    current_row, current_sheet = add_group_methods(
                        group_data,
                        current_row,
                        current_sheet,
                        template_sheet,
                        table_header_start,
                        table_header_end,
                        template_row_num,
                        merged_cells_map,
                        idx,
                    )
                idx += 1
                group_methods = []
                current_group = None
            current_row, current_sheet = process_fractional_composition_oil(
                item["calc"],
                current_row,
                current_sheet,
                template_sheet,
                table_header_start,
                table_header_end,
                template_row_num,
                merged_cells_map,
                idx,
            )
            idx += 1
        elif item["type"] == "standalone":
            if group_methods:
                group_id = current_group
                group_data = grouped_calculations[group_id]

                has_special_methods = any(
                    "нефть" in method.name.lower() or "конденсат" in method.name.lower()
                    for method in group_data["methods"]
                )

                if has_special_methods:
                    group_calc = copy(group_data["calculations"][0])
                    # Временно изменяем имя метода для отображения, потом вернем обратно
                    original_name = group_calc.research_method.name
                    group_calc.research_method.name = group_data["name"]
                    current_row, current_sheet = add_standalone_method(
                        group_calc,
                        current_row,
                        current_sheet,
                        template_sheet,
                        table_header_start,
                        table_header_end,
                        template_row_num,
                        merged_cells_map,
                        idx,
                    )
                    # Возвращаем оригинальное имя
                    group_calc.research_method.name = original_name
                else:
                    current_row, current_sheet = add_group_methods(
                        group_data,
                        current_row,
                        current_sheet,
                        template_sheet,
                        table_header_start,
                        table_header_end,
                        template_row_num,
                        merged_cells_map,
                        idx,
                    )
                idx += 1
                group_methods = []
                current_group = None

            current_row, current_sheet = add_standalone_method(
                item["calc"],
                current_row,
                current_sheet,
                template_sheet,
                table_header_start,
                table_header_end,
                template_row_num,
                merged_cells_map,
                idx,
            )
            idx += 1
        else:
            if current_group is None:
                current_group = item["group_id"]
                group_methods = [item]
            elif current_group == item["group_id"]:
                group_methods.append(item)
            else:
                group_data = grouped_calculations[current_group]

                has_special_methods = any(
                    "нефть" in method.name.lower() or "конденсат" in method.name.lower()
                    for method in group_data["methods"]
                )

                if has_special_methods:
                    group_calc = copy(group_data["calculations"][0])
                    # Временно изменяем имя метода для отображения, потом вернем обратно
                    original_name = group_calc.research_method.name
                    group_calc.research_method.name = group_data["name"]
                    current_row, current_sheet = add_standalone_method(
                        group_calc,
                        current_row,
                        current_sheet,
                        template_sheet,
                        table_header_start,
                        table_header_end,
                        template_row_num,
                        merged_cells_map,
                        idx,
                    )
                    # Возвращаем оригинальное имя
                    group_calc.research_method.name = original_name
                else:
                    current_row, current_sheet = add_group_methods(
                        group_data,
                        current_row,
                        current_sheet,
                        template_sheet,
                        table_header_start,
                        table_header_end,
                        template_row_num,
                        merged_cells_map,
                        idx,
                    )
                idx += 1

                current_group = item["group_id"]
                group_methods = [item]

    if group_methods:
        group_data = grouped_calculations[current_group]

        has_special_methods = any(
            "нефть" in method.name.lower() or "конденсат" in method.name.lower()
            for method in group_data["methods"]
        )

        if has_special_methods:
            group_calc = copy(group_data["calculations"][0])
            # Временно изменяем имя метода для отображения, потом вернем обратно
            original_name = group_calc.research_method.name
            group_calc.research_method.name = group_data["name"]
            current_row, current_sheet = add_standalone_method(
                group_calc,
                current_row,
                current_sheet,
                template_sheet,
                table_header_start,
                table_header_end,
                template_row_num,
                merged_cells_map,
                idx,
            )
            # Возвращаем оригинальное имя
            group_calc.research_method.name = original_name
        else:
            current_row, current_sheet = add_group_methods(
                group_data,
                current_row,
                current_sheet,
                template_sheet,
                table_header_start,
                table_header_end,
                template_row_num,
                merged_cells_map,
                idx,
            )

    return current_sheet


def _collect_equipment_ids_from_samples(samples: List[Sample]) -> set[int]:
    """
    Собирает уникальные ID оборудования из поля calculation.equipment_data для всех проб.
    """
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
    protocol: Protocol,
    samples: List[Sample],
    equipment_list: List[Equipment],
    template_sheet,
    current_sheet,
    table_start,
    merged_cells_map,
    current_row,
):
    """Обрабатывает таблицу с оборудованием."""
    # Дедуплицируем оборудование по ключевым полям
    seen_equipment = set()
    unique_equipment = []

    for equipment in equipment_list:
        # Преобразуем даты в строки для корректного сравнения
        ver_date = None
        if equipment.verification_date:
            if hasattr(equipment.verification_date, "date"):
                ver_date = equipment.verification_date.date().isoformat()
            else:
                ver_date = str(equipment.verification_date)

        ver_end_date = None
        if equipment.verification_end_date:
            if hasattr(equipment.verification_end_date, "date"):
                ver_end_date = equipment.verification_end_date.date().isoformat()
            else:
                ver_end_date = str(equipment.verification_end_date)

        # Создаем ключ из полей для дедупликации
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

    # Сортируем список оборудования по наименованию и версии
    equipment_list = sorted(
        unique_equipment, key=lambda x: (x.name or "", x.version or "")
    )

    if not equipment_list:
        return current_sheet

    table_header_start = None
    table_header_end = None

    for row_num in range(table_start, template_sheet.max_row + 1):
        row = list(
            template_sheet.iter_rows(min_row=row_num, max_row=row_num, values_only=True)
        )[0]

        if table_header_start is None:
            if any(cell and str(cell).strip() == "{{start_table2}}" for cell in row):
                table_header_start = row_num
                continue
        else:
            if any(cell and str(cell).strip() == "{start_table2}" for cell in row):
                table_header_end = row_num
                break

    if table_header_start is None:
        return current_sheet

    if table_header_end is None:
        table_header_end = table_header_start + 1

    template_row_num = None

    for row_num in range(table_header_end, template_sheet.max_row + 1):
        row = list(
            template_sheet.iter_rows(min_row=row_num, max_row=row_num, values_only=True)
        )[0]

        if any(cell and str(cell).strip() == "{start_table2}" for cell in row):
            template_row_num = row_num + 1
            break
        elif any(cell and str(cell).strip() == "{end_table2}" for cell in row):
            break

    if not template_row_num:
        return current_sheet

    sheet_merged_cells_map = current_sheet.merged_cells

    for row_num in range(table_header_start + 1, table_header_end):
        copy_row_formatting(
            template_sheet,
            current_sheet,
            row_num,
            current_row,
            sheet_merged_cells_map,
        )
        current_row += 1

    idx = 1
    for equipment in equipment_list:
        copy_row_formatting(
            template_sheet,
            current_sheet,
            template_row_num,
            current_row,
            sheet_merged_cells_map,
        )

        for col in range(1, template_sheet.max_column + 1):
            cell = current_sheet.cell(row=current_row, column=col)
            if not cell.value:
                continue

            value = str(cell.value)
            if "{id_equipment}" in value:
                cell.value = value.replace("{id_equipment}", str(idx))
            elif "{name_equipment}" in value:
                equipment_name = equipment.name or ""
                cell.value = value.replace("{name_equipment}", equipment_name)
                adjust_cell_height_if_needed(
                    current_sheet, current_row, col, equipment_name
                )
            elif "{serial_num}" in value:
                cell.value = value.replace(
                    "{serial_num}", equipment.serial_number or ""
                )
            elif "{ver_info}" in value:
                verification_info = equipment.verification_info or ""
                cell.value = value.replace("{ver_info}", verification_info)
                adjust_cell_height_if_needed(
                    current_sheet, current_row, col, verification_info
                )
            elif "{ver_date}" in value:
                if equipment.verification_date:
                    formatted_date = pendulum.instance(
                        equipment.verification_date
                    ).format("DD.MM.YYYY")
                    cell.value = value.replace("{ver_date}", formatted_date)
                else:
                    cell.value = value.replace("{ver_date}", "")
            elif "{ver_end_date}" in value:
                if equipment.verification_end_date:
                    formatted_date = pendulum.instance(
                        equipment.verification_end_date
                    ).format("DD.MM.YYYY")
                    cell.value = value.replace("{ver_end_date}", formatted_date)
                else:
                    cell.value = value.replace("{ver_end_date}", "")

        current_row += 1
        idx += 1

    return current_sheet


def process_nd_table(
    protocol: Protocol,
    samples: List[Sample],
    template_sheet,
    current_sheet,
    table_start,
    merged_cells_map,
    current_row,
):
    """Обрабатывает таблицу с нормативными документами."""
    calculations = []
    for sample in samples:
        for calc in sample.calculations:
            if calc.deleted_at is None and calc.research_method:
                calculations.append(calc)

    test_objects = []
    for sample in samples:
        if sample.test_object:
            test_objects.append(sample.test_object)

    valid_calculations = [
        calc
        for calc in calculations
        if check_method_name(calc.research_method.name, test_objects)
    ]

    # Та же сортировка, что в таблице 1: sort_order группы/метода, затем имя.
    def get_sort_key(calc):
        method = calc.research_method
        method_name = method.name or ""
        method_sort_order = method.sort_order if method.sort_order is not None else 0
        if method.groups and len(method.groups) > 0:
            group = method.groups[0]
            group_sort_order = (
                group.sort_order if group.sort_order is not None else method_sort_order
            )
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

    table_header_start = None
    table_header_end = None

    for row_num in range(table_start, template_sheet.max_row + 1):
        row = list(
            template_sheet.iter_rows(min_row=row_num, max_row=row_num, values_only=True)
        )[0]

        if table_header_start is None:
            if any(cell and str(cell).strip() == "{{start_table3}}" for cell in row):
                table_header_start = row_num
                continue
        else:
            if any(cell and str(cell).strip() == "{start_table3}" for cell in row):
                table_header_end = row_num
                break

    if table_header_start is None:
        return current_sheet

    if table_header_end is None:
        table_header_end = table_header_start + 1

    sheet_merged_cells_map = current_sheet.merged_cells

    template_row_num = None

    for row_num in range(table_header_end, template_sheet.max_row + 1):
        row = list(
            template_sheet.iter_rows(min_row=row_num, max_row=row_num, values_only=True)
        )[0]

        if any(cell and str(cell).strip() == "{start_table3}" for cell in row):
            template_row_num = row_num + 1
            break
        elif any(cell and str(cell).strip() == "{end_table3}" for cell in row):
            break

    if not template_row_num:
        return current_sheet

    sheet_merged_cells_map = current_sheet.merged_cells

    for row_num in range(table_header_start + 1, table_header_end):
        copy_row_formatting(
            template_sheet,
            current_sheet,
            row_num,
            current_row,
            sheet_merged_cells_map,
        )
        current_row += 1

    idx = 1
    for nd_code, nd_name in nd_list:
        copy_row_formatting(
            template_sheet,
            current_sheet,
            template_row_num,
            current_row,
            sheet_merged_cells_map,
        )

        for col in range(1, template_sheet.max_column + 1):
            cell = current_sheet.cell(row=current_row, column=col)
            if not cell.value:
                continue

            value = str(cell.value)
            if "{id_nd}" in value:
                cell.value = value.replace("{id_nd}", str(idx))
            elif "{nd_code}" in value:
                cell.value = value.replace("{nd_code}", nd_code)
            elif "{nd_name}" in value or "{name_nd}" in value:
                # Поддерживаем оба варианта плейсхолдера: {nd_name} и {name_nd}
                cell.value = value.replace("{nd_name}", nd_name)
                cell.value = cell.value.replace("{name_nd}", nd_name)
                adjust_cell_height_if_needed(current_sheet, current_row, col, nd_name)

        current_row += 1
        idx += 1

    return current_sheet


async def generate_protocol_excel(db: AsyncSession, protocol_id: int) -> Response:
    """Генерирует Excel файл протокола."""
    try:
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
            raise ValidationError("У протокола отсутствует шаблон Excel")

        sample_ids = protocol.samples or []
        if not sample_ids:
            raise ValidationError("У протокола отсутствуют пробы")

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
            raise ValidationError("У протокола отсутствуют пробы")

        # Загружаем шаблоны условий отбора для лаборатории/подразделения
        selection_conditions_templates = []
        if protocol.laboratory_id or protocol.department_id:
            selection_conditions_query = select(SelectionConditions).where(
                SelectionConditions.deleted_at.is_(None)
            )
            if protocol.laboratory_id:
                selection_conditions_query = selection_conditions_query.where(
                    SelectionConditions.laboratory_id == protocol.laboratory_id
                )
            if protocol.department_id:
                selection_conditions_query = selection_conditions_query.where(
                    SelectionConditions.department_id == protocol.department_id
                )
            selection_conditions_result = await db.execute(selection_conditions_query)
            selection_conditions_list = list(
                selection_conditions_result.scalars().all()
            )
            if selection_conditions_list:
                # Берем первый активный шаблон (обычно должен быть один)
                selection_conditions_templates = [
                    {"conditions": sc.conditions} for sc in selection_conditions_list
                ]

        # Собираем список используемого оборудования для всех расчетов по пробам
        equipment_ids = _collect_equipment_ids_from_samples(samples)
        equipment_list: List[Equipment] = []
        if equipment_ids:
            equipment_query = select(Equipment).where(Equipment.id.in_(equipment_ids))
            equipment_result = await db.execute(equipment_query)
            equipment_list = list(equipment_result.scalars().all())

        file_data = protocol.protocol_template.file
        try:
            template_bytes = BytesIO(base64.b64decode(file_data))
        except Exception:
            try:
                with open(file_data, "rb") as f:
                    template_bytes = BytesIO(f.read())
            except Exception:
                template_bytes = BytesIO(
                    file_data.encode() if isinstance(file_data, str) else file_data
                )

        template_workbook = openpyxl.load_workbook(template_bytes)
        template_sheet = template_workbook.active

        new_workbook = openpyxl.Workbook()
        new_sheet = new_workbook.active
        new_sheet.title = "Лист 1"
        set_sheet_margins(new_sheet)
        enforce_fit_to_page(new_sheet)

        if hasattr(template_sheet, "oddFooter") and hasattr(new_sheet, "oddFooter"):
            new_sheet.oddFooter.left = await process_footer_test_protocol_number(
                protocol, samples, template_sheet.oddFooter.left
            )
            new_sheet.oddFooter.center = await process_footer_test_protocol_number(
                protocol, samples, template_sheet.oddFooter.center
            )
            new_sheet.oddFooter.right = await process_footer_test_protocol_number(
                protocol, samples, template_sheet.oddFooter.right
            )
        if hasattr(template_sheet, "evenFooter") and hasattr(new_sheet, "evenFooter"):
            new_sheet.evenFooter.left = await process_footer_test_protocol_number(
                protocol, samples, template_sheet.evenFooter.left
            )
            new_sheet.evenFooter.center = await process_footer_test_protocol_number(
                protocol, samples, template_sheet.evenFooter.center
            )
            new_sheet.evenFooter.right = await process_footer_test_protocol_number(
                protocol, samples, template_sheet.evenFooter.right
            )
        if hasattr(template_sheet, "firstFooter") and hasattr(new_sheet, "firstFooter"):
            new_sheet.firstFooter.left = await process_footer_test_protocol_number(
                protocol, samples, template_sheet.firstFooter.left
            )
            new_sheet.firstFooter.center = await process_footer_test_protocol_number(
                protocol, samples, template_sheet.firstFooter.center
            )
            new_sheet.firstFooter.right = await process_footer_test_protocol_number(
                protocol, samples, template_sheet.firstFooter.right
            )

        merged_cells_map = new_sheet.merged_cells

        header_end = await process_header(
            protocol,
            samples,
            template_sheet,
            new_sheet,
            merged_cells_map,
            selection_conditions_templates,
        )
        if header_end == 0:
            raise ValidationError("Ошибка при обработке шапки протокола")

        table_start = await process_header_and_conditions(
            protocol,
            samples,
            template_sheet,
            new_sheet,
            header_end,
            merged_cells_map,
            selection_conditions_templates,
        )

        current_sheet = process_methods_table(
            protocol,
            samples,
            template_sheet,
            new_sheet,
            table_start,
            merged_cells_map,
            new_sheet.max_row + 1,
        )
        if not current_sheet:
            raise ValidationError("Ошибка при обработке таблицы методов")

        table1_end = None
        for row_num in range(table_start, template_sheet.max_row + 1):
            row = list(
                template_sheet.iter_rows(
                    min_row=row_num, max_row=row_num, values_only=True
                )
            )[0]
            if any(cell and str(cell).strip() == "{end_table1}" for cell in row):
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
            )

            current_sheet = process_equipment_table(
                protocol,
                samples,
                equipment_list,
                template_sheet,
                current_sheet,
                table1_end + 1,
                merged_cells_map,
                current_row,
            )
            if not current_sheet:
                raise ValidationError("Ошибка при обработке таблицы оборудования")

            table2_end = None
            for row_num in range(table1_end + 1, template_sheet.max_row + 1):
                row = list(
                    template_sheet.iter_rows(
                        min_row=row_num, max_row=row_num, values_only=True
                    )
                )[0]
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
                )

                current_sheet = process_nd_table(
                    protocol,
                    samples,
                    template_sheet,
                    current_sheet,
                    table2_end + 1,
                    merged_cells_map,
                    current_row,
                )
                if not current_sheet:
                    raise ValidationError("Ошибка при обработке таблицы НД")

                table3_end = None
                for row_num in range(table2_end + 1, template_sheet.max_row + 1):
                    row = list(
                        template_sheet.iter_rows(
                            min_row=row_num, max_row=row_num, values_only=True
                        )
                    )[0]
                    if any(
                        cell and str(cell).strip() == "{end_table3}" for cell in row
                    ):
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
                    )

        set_sheet_margins(new_sheet)
        copy_column_dimensions(template_sheet, new_sheet)
        enforce_fit_to_page(new_sheet)

        output = BytesIO()
        new_workbook.save(output)
        output.seek(0)

        # Формируем имя файла: "Протокол_<Номер протокола>.xlsx"
        # Используем базовый номер протокола (без даты и суффиксов)
        protocol_number = None
        if protocol.test_protocol_number:
            protocol_number_str = str(protocol.test_protocol_number).strip()
            if protocol_number_str:
                protocol_number = protocol_number_str

        # Если номер протокола отсутствует, используем ID протокола
        if not protocol_number:
            protocol_number = str(protocol_id)
            logger.warning(
                f"Номер протокола отсутствует для протокола {protocol_id}, используется ID"
            )

        # Очищаем номер протокола от недопустимых символов для имени файла
        clean_protocol_number = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "_", protocol_number)
        clean_protocol_number = clean_protocol_number.replace(" ", "_")

        # Формируем имя файла с русскими символами
        filename_ru = f"Протокол_{clean_protocol_number}.xlsx"

        # Кодируем русское имя файла для HTTP‑заголовка (RFC 5987)
        encoded_filename = quote(filename_ru, safe="", encoding="utf-8")

        # Используем только filename* для избежания проблем с latin-1 кодированием в Starlette
        content_disposition = f"attachment; filename*=UTF-8''{encoded_filename}"

        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": content_disposition},
        )

    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Ошибка при генерации протокола: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при генерации протокола: {str(e)}",
        )
