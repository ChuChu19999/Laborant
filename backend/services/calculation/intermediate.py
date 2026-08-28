from __future__ import annotations
from decimal import Decimal, InvalidOperation
from typing import Any
from core.exceptions import DomainValidationError
from core.logger import logger
from services.calculation.mass_fraction_oil import is_mass_fraction_oil_input_key
from utils.calculation.constants import INPUT_FIELD_COLOR
from utils.calculation.engine import (
    evaluate_formula,
    round_decimal_half_up,
    round_result,
    round_value_by_params,
)
from utils.calculation.result_display import is_chloride_salts_input_key

CALC_ERRORS = (
    ArithmeticError,
    InvalidOperation,
    KeyError,
    TypeError,
    ValueError,
    ZeroDivisionError,
)


def _variables_from_input_data(input_data: dict[str, Any]) -> dict[str, Any]:
    """Оставить только поля, которые участвуют в формулах."""
    return {
        k: v
        for k, v in input_data.items()
        if k != INPUT_FIELD_COLOR and not is_mass_fraction_oil_input_key(k) and not is_chloride_salts_input_key(k)
    }


def _intermediate_values_list(research_method: dict[str, Any]) -> list[dict[str, Any]]:
    """Вернуть список промежуточных значений методики."""
    raw = (research_method.get("intermediate_data") or {}).get("fields") or []
    return [field for field in raw if isinstance(field, dict)]


def get_intermediate_values_by_name(
    research_method: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    """Проиндексировать промежуточные значения методики по имени."""
    return {str(field["name"]): field for field in _intermediate_values_list(research_method) if field.get("name")}


def _entry_uses_custom_rounding(field: dict[str, Any] | None) -> bool:
    """Проверить, задано ли у элемента промежуточных значений своё округление."""
    if not field:
        return False
    if field.get("use_multiple_rounding") or field.get("use_threshold_table"):
        return False
    return field.get("use_result_rounding") is False


def _resolve_intermediate_rounding(
    field: dict[str, Any] | None,
    research_method: dict[str, Any],
    result_decimal_places: int | None,
) -> tuple[str, int] | None:
    """Подобрать тип и параметр округления для промежуточного значения."""
    if field is not None and _entry_uses_custom_rounding(field):
        rounding_type = field.get("rounding_type") or "decimal"
        rounding_decimal = field.get("rounding_decimal")
        if rounding_decimal is None:
            rounding_decimal = research_method.get("rounding_decimal", 0)
        if rounding_type == "significant":
            return ("significant", int(rounding_decimal))
        return ("decimal", int(rounding_decimal))

    if result_decimal_places is not None:
        return ("decimal", int(result_decimal_places))

    if research_method.get("rounding_type") == "decimal":
        method_places = research_method.get("rounding_decimal")
        if method_places is not None:
            return ("decimal", int(method_places))
    elif research_method.get("rounding_type") == "significant":
        return (
            "significant",
            int(research_method.get("rounding_decimal", 3)),
        )
    return None


def _apply_intermediate_rounding(
    value: Any,
    rounding: tuple[str, int] | None,
) -> Any:
    """Округлить промежуточное число по уже подобранному правилу."""
    if rounding is None or not isinstance(value, (int, float, Decimal)):
        return value
    kind, param = rounding
    if kind == "decimal":
        return round_decimal_half_up(value, param)
    if kind == "significant":
        return round_result(value, "significant", param)
    return value


def _evaluate_intermediate_entry(
    field: dict[str, Any],
    variables: dict[str, Any],
    intermediate_values_by_name: dict[str, dict[str, Any]],
) -> Any:
    """Посчитать одно промежуточное значение по формуле."""
    if field.get("use_threshold_table"):
        threshold_cfg = field["threshold_table_values"]
        target_field = intermediate_values_by_name.get(threshold_cfg["target_variable"])
        formula = target_field["formula"] if target_field else field["formula"]
        return round_value_by_params(
            value=0,
            rounding_type="threshold_table",
            threshold_table_values={
                "target_variable": threshold_cfg["target_variable"],
                "higher_variable": threshold_cfg["higher_variable"],
                "lower_variable": threshold_cfg["lower_variable"],
                "formula": formula,
            },
            variables=variables,
        )

    rounding_params = None
    if field.get("use_multiple_rounding"):
        rounding_params = {
            "use_multiple_rounding": True,
            "rounding_type": field.get("rounding_type"),
            "rounding_decimal": field.get("rounding_decimal"),
            "multiple_value": field.get("multiple_value"),
        }

    return evaluate_formula(
        field["formula"],
        variables,
        range_calculation=field.get("range_calculation"),
        rounding_params=rounding_params,
    )


def build_variables_rounded_chain(
    input_data: dict[str, Any],
    research_method: dict[str, Any],
    intermediate_values_by_name: dict[str, dict[str, Any]],
    result_decimal_places: int | None,
) -> dict[str, Any]:
    """Пересчитать промежуточные значения, подставляя уже округлённые значения."""
    variables_rounded = _variables_from_input_data(input_data)
    logger.debug("Пересчёт промежуточных с округлением для цепочки формул")
    for field in _intermediate_values_list(research_method):
        if not field.get("name", "").strip() or not field.get("formula", "").strip():
            continue
        field_name = field["name"]
        try:
            intermediate_value = _evaluate_intermediate_entry(field, variables_rounded, intermediate_values_by_name)
            repeat_rounding = _resolve_intermediate_rounding(field, research_method, result_decimal_places)
            if repeat_rounding is not None and isinstance(intermediate_value, (int, float, Decimal)):
                rounded_value = _apply_intermediate_rounding(intermediate_value, repeat_rounding)
                variables_rounded[field_name] = rounded_value
                logger.debug("{}: {} -> {}", field_name, intermediate_value, rounded_value)
            else:
                variables_rounded[field_name] = intermediate_value
                logger.debug("{}: {}", field_name, intermediate_value)
        except CALC_ERRORS as e:
            logger.error("Ошибка при пересчёте промежуточного {}: {}", field_name, e)
            raise DomainValidationError(f"Ошибка при пересчёте промежуточного результата: {e!s}") from e
    return variables_rounded


def _format_intermediate_display_entry(
    unrounded_value: Any,
    chain_value: Any,
    field: dict[str, Any] | None,
    research_method: dict[str, Any],
    result_decimal_places: int | None,
) -> dict[str, str]:
    """Собрать отображаемое значение и справочное (с дополнительным знаком после запятой)."""
    reference_formatted = _format_intermediate_value_reference(
        unrounded_value, field, research_method, result_decimal_places
    )
    if isinstance(chain_value, (int, float, Decimal)):
        return {
            "value": str(chain_value),
            "reference": reference_formatted["reference"],
        }
    return reference_formatted


def filter_intermediate_results_for_display(
    intermediate_results: dict[str, Any],
    intermediate_values_by_name: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Убрать из ответа промежуточные результаты, скрытые настройкой методики."""
    return {
        name: value
        for name, value in intermediate_results.items()
        if intermediate_values_by_name.get(name, {}).get("show_calculation", True)
    }


def _format_intermediate_value_reference(
    unrounded_value: Any,
    field: dict[str, Any] | None,
    research_method: dict[str, Any],
    result_decimal_places: int | None,
) -> dict[str, str]:
    """Округлить неокруглённый результат для отображения и для справки."""
    if not isinstance(unrounded_value, (int, float, Decimal)):
        text = str(unrounded_value)
        return {"value": text, "reference": text}

    rounding = _resolve_intermediate_rounding(field, research_method, result_decimal_places)
    if rounding is None:
        text = str(unrounded_value)
        return {"value": text, "reference": text}

    kind, param = rounding
    if kind == "significant":
        rounded_value = round_result(unrounded_value, "significant", param)
        reference_value = round_result(unrounded_value, "significant", param + 1)
        return {
            "value": str(rounded_value),
            "reference": str(reference_value),
        }

    rounded_value = _apply_intermediate_rounding(unrounded_value, rounding)
    reference_value = round_decimal_half_up(unrounded_value, param + 1)
    return {
        "value": str(rounded_value),
        "reference": str(reference_value),
    }


def compute_intermediate_pass(
    input_data: dict[str, Any],
    research_method: dict[str, Any],
    intermediate_values_by_name: dict[str, dict[str, Any]],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Посчитать все промежуточные результаты и наполнить ими набор переменных."""
    intermediate_results_unrounded: dict[str, Any] = {}
    variables = _variables_from_input_data(input_data)

    logger.debug("Промежуточный проход")
    for field in _intermediate_values_list(research_method):
        if not field.get("name", "").strip() or not field.get("formula", "").strip():
            continue

        field_name = field["name"]
        try:
            intermediate_value = _evaluate_intermediate_entry(field, variables, intermediate_values_by_name)
            intermediate_results_unrounded[field_name] = intermediate_value
            chain_rounding = _resolve_intermediate_rounding(field, research_method, None)
            if chain_rounding is not None and isinstance(intermediate_value, (int, float, Decimal)):
                variables[field_name] = _apply_intermediate_rounding(intermediate_value, chain_rounding)
            else:
                variables[field_name] = intermediate_value
            logger.debug(
                "{}: value={}, formula={}",
                field_name,
                intermediate_value,
                field["formula"],
            )
        except CALC_ERRORS as e:
            logger.error("Ошибка при вычислении промежуточного {}: {}", field_name, e)
            raise DomainValidationError(f"Ошибка при вычислении промежуточного результата: {e!s}") from e

    return intermediate_results_unrounded, variables


def estimate_result_decimal_places(
    research_method: dict[str, Any],
    variables: dict[str, Any],
) -> int | None:
    """Определить, сколько знаков после запятой будет у итогового результата."""
    rounding_type = research_method["rounding_type"]
    try:
        result_unrounded = evaluate_formula(research_method["formula"], variables)
        result_temp = round_result(
            result_unrounded,
            rounding_type,
            research_method["rounding_decimal"],
        )
        places = len(str(result_temp).split(".")[-1]) if "." in str(result_temp) else 0
        logger.debug("Знаков после запятой у итога: {}", places)
        return places
    except CALC_ERRORS as e:
        if rounding_type == "decimal":
            logger.warning("Не удалось определить число знаков: {}, берём настройки метода", e)
            return research_method["rounding_decimal"]
        logger.warning("Не удалось определить число знаков (significant): {}", e)
        return research_method.get("rounding_decimal", 3)


def build_rounded_intermediate_display(
    intermediate_results_unrounded: dict[str, Any],
    variables_rounded: dict[str, Any],
    intermediate_values_by_name: dict[str, dict[str, Any]],
    research_method: dict[str, Any],
    result_decimal_places: int | None,
) -> dict[str, dict[str, str]]:
    """Подготовить промежуточные результаты для показа в ответе."""
    intermediate_results_rounded: dict[str, dict[str, str]] = {}
    for field_name, unrounded_value in intermediate_results_unrounded.items():
        field_cfg = intermediate_values_by_name.get(field_name)
        formatted = _format_intermediate_display_entry(
            unrounded_value,
            variables_rounded.get(field_name, unrounded_value),
            field_cfg,
            research_method,
            result_decimal_places,
        )
        intermediate_results_rounded[field_name] = formatted
        logger.debug(
            "{} (отображение): value={}, reference={}",
            field_name,
            formatted["value"],
            formatted["reference"],
        )
    return intermediate_results_rounded


__all__ = [
    "CALC_ERRORS",
    "build_rounded_intermediate_display",
    "build_variables_rounded_chain",
    "compute_intermediate_pass",
    "estimate_result_decimal_places",
    "filter_intermediate_results_for_display",
    "get_intermediate_values_by_name",
]
