import re
from typing import Any
import orjson
from schemas.sample_export import ResearchMethodExportInfo, SampleExportCalculation
from utils.calculation_result_display import get_chloride_salts_result_display


def _format_number_with_minus(value: str) -> str:
    return re.sub(r"^-", "минус ", value)


def _get_condensate_kk_measurement_error(raw_value: Any) -> str:
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
    num_value = float(value.replace(",", "."))
    if field_name in (
        "Температура н.к.",
        "10% отгона при температуре",
        "50% отгона при температуре",
    ):
        return str(round(num_value))
    return f"{num_value:.1f}".replace(".", ",")


def _round_value_for_condensate_fractional(value: str, field_name: str) -> str:
    num_value = float(value.replace(",", "."))
    lower_name = field_name.lower()
    if "температура" in lower_name or "отгона при температуре" in lower_name:
        return str(round(num_value))
    return f"{num_value:.1f}".replace(".", ",")


def get_method_display_name(
    method: ResearchMethodExportInfo | None,
) -> str:
    if not method:
        return "-"

    base_name = method.name or ""
    lower_name = base_name.lower()

    if "фракционный состав" in lower_name:
        return re.sub(r"\s*\([^)]*\)\s*$", "", base_name).strip()

    if method.is_group_member and method.groups:
        group_name = method.groups[0].get("name", "") if method.groups else ""
        if group_name:
            if group_name == "Вязкость кинематическая":
                return f"{group_name} ({base_name.lower()})"
            return group_name

    return base_name


def _format_fractional_result_text(result: str, method_name: str) -> str:
    try:
        parsed = orjson.loads(result)
        if not isinstance(parsed, dict):
            formatted = str(result).replace(".", ",")
            return _format_number_with_minus(formatted)

        is_condensate = method_name == "Фракционный состав (конденсат)"
        is_oil = method_name == "Фракционный состав (нефть)"
        lines: list[str] = []

        for key, value in parsed.items():
            if value is None or value == "-":
                continue

            corrected_key = key.replace("н,к.", "н.к.")
            if isinstance(value, (int, float)):
                val_str = str(value)
                if is_oil:
                    formatted_value = _round_value_for_oil_fractional(
                        val_str, corrected_key
                    )
                elif is_condensate:
                    formatted_value = _round_value_for_condensate_fractional(
                        val_str, corrected_key
                    )
                else:
                    formatted_value = val_str.replace(".", ",")
            else:
                str_value = str(value)
                normalized = str_value.replace(",", ".")
                try:
                    float(normalized)
                    if is_oil:
                        formatted_value = _round_value_for_oil_fractional(
                            str_value, corrected_key
                        )
                    elif is_condensate:
                        formatted_value = _round_value_for_condensate_fractional(
                            str_value, corrected_key
                        )
                    else:
                        formatted_value = re.sub(r"(-?\d+)\.(\d+)", r"\1,\2", str_value)
                except ValueError:
                    formatted_value = re.sub(r"(-?\d+)\.(\d+)", r"\1,\2", str_value)

            formatted_value = _format_number_with_minus(formatted_value)
            lines.append(f"{corrected_key} = {formatted_value}")

        return "\n".join(lines) if lines else "-"
    except (orjson.JSONDecodeError, TypeError):
        formatted = str(result).replace(".", ",")
        return _format_number_with_minus(formatted)


def _format_fractional_error_text(
    measurement_error: str | None,
    method_name: str,
    result: str | None,
) -> str:
    is_fractional = method_name and "фракционный состав" in method_name.lower()

    if is_fractional and result:
        is_condensate = method_name == "Фракционный состав (конденсат)"
        is_oil = method_name == "Фракционный состав (нефть)"

        if is_condensate or is_oil:
            try:
                parsed_result = (
                    orjson.loads(result) if isinstance(result, str) else result
                )
                if isinstance(parsed_result, dict):
                    error_map: dict[str, str] = {}

                    if is_condensate:
                        for key in parsed_result:
                            corrected_key = key.replace("н,к.", "н.к.")
                            if corrected_key == "Температура н.к.":
                                error_map[corrected_key] = "±5"
                            elif corrected_key == "10% отгона при температуре":
                                error_map[corrected_key] = "±4"
                            elif corrected_key == "50% отгона при температуре":
                                error_map[corrected_key] = "±2"
                            elif corrected_key == "90% отгона при температуре":
                                error_map[corrected_key] = "±5"
                            elif corrected_key == "Объемная доля остатка":
                                error_map[corrected_key] = "±0,3"
                            elif corrected_key == "Температура к.к.":
                                error_map[corrected_key] = (
                                    _get_condensate_kk_measurement_error(
                                        parsed_result[key]
                                    )
                                )
                            else:
                                error_map[corrected_key] = "-"
                    elif is_oil:
                        for key in parsed_result:
                            corrected_key = key.replace("н,к.", "н.к.")
                            if corrected_key == "Температура н.к.":
                                error_map[corrected_key] = "±5"
                            elif (
                                "% отгона при температуре" in corrected_key
                                or "выход фракций" in corrected_key
                                or "Выход фракций" in corrected_key
                            ):
                                error_map[corrected_key] = "±1,4"
                            else:
                                error_map[corrected_key] = "-"

                    error_lines: list[str] = []
                    for key, value in parsed_result.items():
                        corrected_key = key.replace("н,к.", "н.к.")
                        if value is not None and value != "-":
                            error_lines.append(error_map.get(corrected_key, "-"))

                    return "\n".join(error_lines) if error_lines else "-"
            except (orjson.JSONDecodeError, TypeError):
                if measurement_error and measurement_error != "-":
                    return f"±{measurement_error}"
                return "-"

    if not measurement_error or measurement_error == "-":
        return "-"

    formatted_error = str(measurement_error).replace(".", ",")
    formatted_error = _format_number_with_minus(formatted_error)
    if formatted_error.startswith(("±", "+", "минус")):
        return formatted_error
    return f"± {formatted_error}"


def _format_fractional_unit_text(
    calc: SampleExportCalculation,
    method: ResearchMethodExportInfo,
) -> str:
    result = calc.result
    unit = calc.unit

    try:
        parsed = orjson.loads(result) if isinstance(result, str) else result
        if not isinstance(parsed, dict):
            return unit or method.unit or "-"

        entries = list(parsed.items())
        if not entries:
            return unit or method.unit or "-"

        input_fields = (method.input_data or {}).get("fields") or []

        def get_unit_for_key(key: str) -> str:
            for field in input_fields:
                if field.get("name") == key and field.get("unit"):
                    return str(field["unit"])

            parts = key.split(" ")
            if len(parts) >= 2:
                tail_name = " ".join(parts[-2:])
                for field in input_fields:
                    if field.get("name") == tail_name and field.get("unit"):
                        return str(field["unit"])

            return unit or method.unit or "-"

        unit_lines: list[str] = []
        for key, value in entries:
            corrected_key = key.replace("н,к.", "н.к.")
            if value is None or value == "-":
                continue
            unit_lines.append(get_unit_for_key(corrected_key))

        return "\n".join(unit_lines) if unit_lines else (unit or method.unit or "-")
    except (orjson.JSONDecodeError, TypeError):
        return unit or method.unit or "-"


def _join_result_error_unit(result: str, error: str, unit: str) -> str:
    parts = [part for part in (result, error, unit) if part and part != "-"]
    return " ".join(parts) if parts else "-"


def _format_fractional_lines(
    calc: SampleExportCalculation,
    method: ResearchMethodExportInfo,
    method_name: str,
) -> str:
    result_lines = _format_fractional_result_text(calc.result, method_name).split("\n")
    error_lines = _format_fractional_error_text(
        calc.measurement_error, method_name, calc.result
    ).split("\n")
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
    method = calc.research_method
    method_name = method.name if method else ""

    if not calc.result or calc.result == "-":
        return "-"

    chloride_display = get_chloride_salts_result_display(calc.input_data)
    if chloride_display:
        error = _format_fractional_error_text(
            calc.measurement_error, method_name, calc.result
        )
        unit = calc.unit or (method.unit if method else None) or "-"
        return _join_result_error_unit(chloride_display, error, unit)

    if method and "фракционный состав" in method_name.lower():
        return _format_fractional_lines(calc, method, method_name)

    result = calc.result.replace(".", ",") if calc.result else "-"
    if "Фракционный состав" in method_name:
        result = _format_fractional_result_text(calc.result, method_name)

    result = _format_number_with_minus(result)
    error = _format_fractional_error_text(
        calc.measurement_error, method_name, calc.result
    )
    unit = calc.unit or (method.unit if method else None) or "-"

    return _join_result_error_unit(result, error, unit)


def format_calculation_export_entry(calc: SampleExportCalculation) -> str:
    method_name = get_method_display_name(calc.research_method)
    value_block = format_calculation_value_block(calc)

    if value_block == "-":
        return method_name

    return f"{method_name}: {value_block}"


def format_sample_calculations_column(
    calculations: list[SampleExportCalculation] | None,
) -> str:
    if not calculations:
        return "-"

    return "\n\n".join(format_calculation_export_entry(calc) for calc in calculations)
