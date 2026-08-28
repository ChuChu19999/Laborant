from __future__ import annotations
import re
from typing import Any
import orjson
from schemas.sample_export import ResearchMethodExportInfo, SampleExportCalculation
from utils.calculation.constants import METHOD_FRACTIONAL_CONDENSATE, METHOD_FRACTIONAL_OIL
from utils.calculation.fractional_keys import normalize_fractional_key
from utils.calculation.result_display import get_chloride_salts_result_display

_OIL_INTEGER_FIELDS = frozenset(
    {
        "Температура н.к.",
        "10% отгона при температуре",
        "50% отгона при температуре",
    }
)

_CONDENSATE_ERROR_BY_FIELD: dict[str, str] = {
    "Температура н.к.": "±5",
    "10% отгона при температуре": "±4",
    "50% отгона при температуре": "±2",
    "90% отгона при температуре": "±5",
    "Объёмная доля остатка": "±0,3",
}


def _format_number_with_minus(value: str) -> str:
    """Заменяет ведущий минус на слово «минус» для экспорта."""
    return re.sub(r"^-", "минус ", value)


def _is_fractional_method(method_name: str) -> bool:
    """Проверить, что методика — фракционный состав."""
    return "фракционный состав" in method_name.lower()


def _get_condensate_kk_measurement_error(raw_value: Any) -> str:
    """Погрешность температуры к.к. конденсата: «-» при значении выше 360."""
    str_val = str(raw_value or "").strip().lower()
    if str_val == "выше 360":
        return "-"
    try:
        num = float(str(raw_value).replace(",", "."))
        if num > 360:
            return "-"
    except (TypeError, ValueError):
        pass
    return "±7"


def _round_value_for_oil_fractional(value: str, field_name: str) -> str:
    """Округлить значение показателя фракционного состава нефти."""
    num_value = float(value.replace(",", "."))
    if field_name in _OIL_INTEGER_FIELDS:
        return str(round(num_value))
    return f"{num_value:.1f}".replace(".", ",")


def _round_value_for_condensate_fractional(value: str, field_name: str) -> str:
    """Округлить значение показателя фракционного состава конденсата."""
    num_value = float(value.replace(",", "."))
    lower_name = field_name.lower()
    if "температура" in lower_name or "отгона при температуре" in lower_name:
        return str(round(num_value))
    return f"{num_value:.1f}".replace(".", ",")


def _format_fractional_field_value(value: Any, field_name: str, method_name: str) -> str:
    """Форматирует одно значение показателя фракционного состава."""
    is_condensate = method_name == METHOD_FRACTIONAL_CONDENSATE
    is_oil = method_name == METHOD_FRACTIONAL_OIL

    if isinstance(value, (int, float)):
        val_str = str(value)
        if is_oil:
            return _round_value_for_oil_fractional(val_str, field_name)
        if is_condensate:
            return _round_value_for_condensate_fractional(val_str, field_name)
        return val_str.replace(".", ",")

    str_value = str(value)
    try:
        float(str_value.replace(",", "."))
    except ValueError:
        return re.sub(r"(-?\d+)\.(\d+)", r"\1,\2", str_value)

    if is_oil:
        return _round_value_for_oil_fractional(str_value, field_name)
    if is_condensate:
        return _round_value_for_condensate_fractional(str_value, field_name)
    return re.sub(r"(-?\d+)\.(\d+)", r"\1,\2", str_value)


def get_method_display_name(method: ResearchMethodExportInfo | None) -> str:
    """Возвращает название методики для колонки экспорта."""
    if not method:
        return "-"

    base_name = method.name or ""

    if _is_fractional_method(base_name):
        return re.sub(r"\s*\([^)]*\)\s*$", "", base_name).strip()

    if method.is_group_member and method.groups:
        group_name = method.groups[0].name
        if group_name:
            if group_name == "Вязкость кинематическая":
                return f"{group_name} ({base_name.lower()})"
            return group_name

    return base_name


def _format_fractional_result_text(result: str, method_name: str) -> str:
    """Собирает многострочный текст результатов фракционного состава."""
    try:
        parsed = orjson.loads(result)
        if not isinstance(parsed, dict):
            formatted = str(result).replace(".", ",")
            return _format_number_with_minus(formatted)

        lines: list[str] = []
        for key, value in parsed.items():
            if value is None or value == "-":
                continue
            corrected_key = normalize_fractional_key(str(key))
            formatted_value = _format_number_with_minus(
                _format_fractional_field_value(value, corrected_key, method_name)
            )
            lines.append(f"{corrected_key} = {formatted_value}")

        return "\n".join(lines) if lines else "-"
    except (orjson.JSONDecodeError, TypeError):
        formatted = str(result).replace(".", ",")
        return _format_number_with_minus(formatted)


def _condensate_error_for_field(field_name: str, raw_value: Any) -> str:
    """Вернуть погрешность показателя фракционного состава конденсата."""
    if field_name == "Температура к.к.":
        return _get_condensate_kk_measurement_error(raw_value)
    return _CONDENSATE_ERROR_BY_FIELD.get(field_name, "-")


def _oil_error_for_field(field_name: str) -> str:
    """Вернуть погрешность показателя фракционного состава нефти."""
    if field_name == "Температура н.к.":
        return "±5"
    lower_name = field_name.lower()
    if "% отгона при температуре" in field_name or "выход фракций" in lower_name:
        return "±1,4"
    return "-"


def _build_fractional_error_map(parsed_result: dict[str, Any], method_name: str) -> dict[str, str]:
    """Собрать карту погрешностей по показателям фракционного результата."""
    error_map: dict[str, str] = {}
    is_condensate = method_name == METHOD_FRACTIONAL_CONDENSATE
    is_oil = method_name == METHOD_FRACTIONAL_OIL

    for key, raw_value in parsed_result.items():
        corrected_key = normalize_fractional_key(str(key))
        if is_condensate:
            error_map[corrected_key] = _condensate_error_for_field(corrected_key, raw_value)
        elif is_oil:
            error_map[corrected_key] = _oil_error_for_field(corrected_key)
    return error_map


def _format_measurement_error_text(
    measurement_error: str | None,
    method_name: str,
    result: str | None,
) -> str:
    """Форматирует погрешность: для фракционного состава — по строкам показателей."""
    if _is_fractional_method(method_name) and result:
        is_condensate = method_name == METHOD_FRACTIONAL_CONDENSATE
        is_oil = method_name == METHOD_FRACTIONAL_OIL

        if is_condensate or is_oil:
            try:
                parsed_result = orjson.loads(result) if isinstance(result, str) else result
                if isinstance(parsed_result, dict):
                    error_map = _build_fractional_error_map(parsed_result, method_name)
                    error_lines: list[str] = []
                    for key, value in parsed_result.items():
                        corrected_key = normalize_fractional_key(str(key))
                        if value is not None and value != "-":
                            error_lines.append(error_map.get(corrected_key, "-"))
                    return "\n".join(error_lines) if error_lines else "-"
            except (orjson.JSONDecodeError, TypeError):
                if measurement_error and measurement_error != "-":
                    return f"±{measurement_error}"
                return "-"

    if not measurement_error or measurement_error == "-":
        return "-"

    formatted_error = _format_number_with_minus(str(measurement_error).replace(".", ","))
    if formatted_error.startswith(("±", "+", "минус")):
        return formatted_error
    return f"± {formatted_error}"


def _unit_for_fractional_key(
    key: str,
    input_fields: list[Any],
    fallback_unit: str,
) -> str:
    """Ищет единицу измерения показателя во входных полях методики."""
    for field in input_fields:
        if not isinstance(field, dict):
            continue
        if field.get("name") == key and field.get("unit"):
            return str(field["unit"])

    parts = key.split(" ")
    if len(parts) >= 2:
        tail_name = " ".join(parts[-2:])
        for field in input_fields:
            if not isinstance(field, dict):
                continue
            if field.get("name") == tail_name and field.get("unit"):
                return str(field["unit"])

    return fallback_unit


def _format_fractional_unit_text(
    calc: SampleExportCalculation,
    method: ResearchMethodExportInfo,
) -> str:
    """Собирает единицы измерения по строкам фракционного результата."""
    result = calc.result
    unit = calc.unit
    fallback = unit or method.unit or "-"

    try:
        parsed = orjson.loads(result) if isinstance(result, str) else result
        if not isinstance(parsed, dict):
            return fallback

        entries = list(parsed.items())
        if not entries:
            return fallback

        raw_fields = (method.input_data or {}).get("fields") or []
        input_fields = raw_fields if isinstance(raw_fields, list) else []

        unit_lines: list[str] = []
        for key, value in entries:
            corrected_key = normalize_fractional_key(str(key))
            if value is None or value == "-":
                continue
            unit_lines.append(_unit_for_fractional_key(corrected_key, input_fields, fallback))

        return "\n".join(unit_lines) if unit_lines else fallback
    except (orjson.JSONDecodeError, TypeError):
        return fallback


def _join_result_error_unit(result: str, error: str, unit: str) -> str:
    """Склеить результат, погрешность и единицу в одну строку экспорта."""
    parts = [part for part in (result, error, unit) if part and part != "-"]
    return " ".join(parts) if parts else "-"


def _format_fractional_lines(
    calc: SampleExportCalculation,
    method: ResearchMethodExportInfo,
    method_name: str,
) -> str:
    """Склеивает результат, погрешность и единицу построчно для фракционного состава."""
    result_lines = _format_fractional_result_text(calc.result, method_name).split("\n")
    error_lines = _format_measurement_error_text(calc.measurement_error, method_name, calc.result).split("\n")
    unit_lines = _format_fractional_unit_text(calc, method).split("\n")

    max_lines = max(len(result_lines), len(error_lines), len(unit_lines))
    combined: list[str] = []

    for index in range(max_lines):
        line = _join_result_error_unit(
            result_lines[index] if index < len(result_lines) else "-",
            error_lines[index] if index < len(error_lines) else "-",
            unit_lines[index] if index < len(unit_lines) else "-",
        )
        if line != "-":
            combined.append(line)

    return "\n".join(combined) if combined else "-"


def format_calculation_value_block(calc: SampleExportCalculation) -> str:
    """Форматирует блок «результат ±погрешность единица» для одного расчёта."""
    method = calc.research_method
    method_name = method.name if method else ""

    if not calc.result or calc.result == "-":
        return "-"

    chloride_display = get_chloride_salts_result_display(calc.input_data)
    if chloride_display:
        error = _format_measurement_error_text(calc.measurement_error, method_name, calc.result)
        unit = calc.unit or (method.unit if method else None) or "-"
        return _join_result_error_unit(chloride_display, error, unit)

    if method and _is_fractional_method(method_name):
        return _format_fractional_lines(calc, method, method_name)

    result = _format_number_with_minus(calc.result.replace(".", ","))
    error = _format_measurement_error_text(calc.measurement_error, method_name, calc.result)
    unit = calc.unit or (method.unit if method else None) or "-"

    return _join_result_error_unit(result, error, unit)


def format_calculation_export_entry(calc: SampleExportCalculation) -> str:
    """Строка экспорта: «название методики: значение»."""
    method_name = get_method_display_name(calc.research_method)
    value_block = format_calculation_value_block(calc)

    if value_block == "-":
        return method_name

    return f"{method_name}: {value_block}"


def format_sample_calculations_column(
    calculations: list[SampleExportCalculation] | None,
) -> str:
    """Колонка «Методы и результаты» для одной пробы в Excel-экспорте."""
    if not calculations:
        return "-"

    return "\n\n".join(format_calculation_export_entry(calc) for calc in calculations)
