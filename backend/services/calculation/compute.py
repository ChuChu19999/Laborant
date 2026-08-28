from __future__ import annotations
from decimal import Decimal
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import DomainValidationError
from core.logger import logger
from schemas.calculation import CalculateResponse
from services.calculation.chloride_salts import (
    clear_chloride_salts_result_display,
    is_chloride_salts_method,
)
from services.calculation.convergence import build_early_convergence_response, evaluate_convergence
from services.calculation.fractional_composition import (
    calculate_fractional_condensate,
    calculate_fractional_oil,
)
from services.calculation.intermediate import (
    CALC_ERRORS,
    build_rounded_intermediate_display,
    build_variables_rounded_chain,
    compute_intermediate_pass,
    estimate_result_decimal_places,
    filter_intermediate_results_for_display,
    get_intermediate_values_by_name,
)
from services.calculation.mass_fraction_oil import (
    is_mass_fraction_oil_method,
    prepare_mass_fraction_oil_input,
)
from utils.calculation.constants import METHOD_FRACTIONAL_CONDENSATE, METHOD_FRACTIONAL_OIL
from utils.calculation.engine import (
    evaluate_formula,
    parse_decimal_value,
    round_decimal_half_up,
    round_result,
)


def _normalize_empty_inputs(input_data: dict[str, Any]) -> dict[str, Any]:
    """Подставить ноль вместо пустых входных значений."""
    processed: dict[str, Any] = {}
    for key, value in input_data.items():
        if key == "_fractional_data":
            processed[key] = value
            continue
        if value is None or (isinstance(value, str) and value.strip() == ""):
            processed[key] = "0"
            logger.debug("Пустое значение в поле {} заменено на '0'", key)
        else:
            processed[key] = value
    return processed


def _dispatch_special_methods(
    input_data: dict[str, Any],
    research_method: dict[str, Any],
) -> CalculateResponse | None:
    """Вернуть ответ для фракционного состава или None для обычного расчёта."""
    method_name = research_method.get("name")
    if method_name == METHOD_FRACTIONAL_CONDENSATE:
        logger.debug("Специальный метод: {}", METHOD_FRACTIONAL_CONDENSATE)
        return calculate_fractional_condensate(input_data)
    if method_name == METHOD_FRACTIONAL_OIL:
        logger.debug("Специальный метод: {}", METHOD_FRACTIONAL_OIL)
        return calculate_fractional_oil(input_data)
    return None


def _compute_satisfactory_result_and_error(
    *,
    research_method: dict[str, Any],
    variables: dict[str, Any],
    variables_rounded: dict[str, Any],
    intermediate_results_unrounded: dict[str, Any],
    intermediate_values_by_name: dict[str, dict[str, Any]],
    result_decimal_places: int | None,
) -> tuple[Any, Any, Any, dict[str, Any]]:
    """Посчитать итог, справочное значение и погрешность при удовлетворительной повторяемости."""
    intermediate_results_rounded = build_rounded_intermediate_display(
        intermediate_results_unrounded,
        variables_rounded,
        intermediate_values_by_name,
        research_method,
        result_decimal_places,
    )

    try:
        result_unrounded_rounded = evaluate_formula(research_method["formula"], variables_rounded)
        result = round_result(
            result_unrounded_rounded,
            research_method["rounding_type"],
            research_method["rounding_decimal"],
        )
        logger.debug(
            "Результат: неокруглённый={}, округлённый={}, формула={}",
            result_unrounded_rounded,
            result,
            research_method["formula"],
        )

        if result_decimal_places is not None:
            result_decimal = parse_decimal_value(result_unrounded_rounded)
            result_reference = round_decimal_half_up(result_decimal, result_decimal_places + 1)
        else:
            result_reference = None
    except CALC_ERRORS as e:
        logger.error("Ошибка при вычислении основного результата: {}", e)
        raise DomainValidationError(f"Ошибка при вычислении результата: {e!s}") from e

    intermediate_results = filter_intermediate_results_for_display(
        intermediate_results_rounded, intermediate_values_by_name
    )

    try:
        error_config = research_method.get("measurement_error") or {}
        error_type = error_config.get("type")

        if not error_type:
            measurement_error = None
        elif error_type == "fixed":
            measurement_error = parse_decimal_value(error_config["value"])
        elif error_type == "formula":
            variables["result"] = result
            measurement_error = evaluate_formula(error_config["value"], variables)
        else:
            logger.warning("Неподдерживаемый тип погрешности: {}", error_type)
            measurement_error = Decimal("0")

        if measurement_error is not None and result_decimal_places is not None:
            measurement_error = round_decimal_half_up(measurement_error, result_decimal_places)

        logger.debug("Погрешность: type={}, value={}", error_type, measurement_error)

    except CALC_ERRORS as e:
        logger.error("Ошибка при вычислении погрешности: {}", e)
        raise DomainValidationError(f"Ошибка при вычислении погрешности: {e!s}") from e

    return result, result_reference, measurement_error, intermediate_results


async def calculate_result(
    db: AsyncSession,
    input_data: dict[str, Any],
    research_method: dict[str, Any],
) -> CalculateResponse:
    """Посчитать итог по методике."""
    method_name = research_method.get("name") if research_method else None
    logger.debug("Начало расчёта, метод={}", method_name)

    if not input_data or not research_method:
        raise DomainValidationError("Необходимо предоставить входные данные и метод исследования")

    input_data = _normalize_empty_inputs(input_data)

    if is_chloride_salts_method(research_method):
        clear_chloride_salts_result_display(input_data)

    await prepare_mass_fraction_oil_input(db, input_data, research_method)

    special = _dispatch_special_methods(input_data, research_method)
    if special is not None:
        logger.debug(
            "Расчёт завершён спецметодом: convergence={}, result={}",
            special.convergence,
            special.result,
        )
        return special

    if research_method["rounding_type"] not in ["decimal", "significant"]:
        raise DomainValidationError(f"Неверный тип округления: {research_method['rounding_type']}")

    intermediate_by_name = get_intermediate_values_by_name(research_method)
    intermediate_results_unrounded, variables = compute_intermediate_pass(
        input_data,
        research_method,
        intermediate_by_name,
    )
    result_decimal_places = estimate_result_decimal_places(research_method, variables)

    variables_rounded = build_variables_rounded_chain(
        input_data,
        research_method,
        intermediate_by_name,
        result_decimal_places,
    )

    convergence_result, custom_value, conditions_info = evaluate_convergence(
        research_method,
        variables_rounded,
    )
    logger.debug("Повторяемость: {}, custom_value={}", convergence_result, custom_value)

    if convergence_result in ["absence", "traces", "unsatisfactory", "custom"]:
        response = build_early_convergence_response(
            input_data=input_data,
            research_method=research_method,
            intermediate_values_by_name=intermediate_by_name,
            intermediate_results_unrounded=intermediate_results_unrounded,
            convergence_result=convergence_result,
            custom_value=custom_value,
            conditions_info=conditions_info,
        )
        logger.debug(
            "Ответ без числового итога: convergence={}, result={}",
            response.convergence,
            response.result,
        )
        return response

    result, result_reference, measurement_error, intermediate_results = _compute_satisfactory_result_and_error(
        research_method=research_method,
        variables=variables,
        variables_rounded=variables_rounded,
        intermediate_results_unrounded=intermediate_results_unrounded,
        intermediate_values_by_name=intermediate_by_name,
        result_decimal_places=result_decimal_places,
    )

    response = CalculateResponse.model_validate(
        {
            "convergence": convergence_result,
            "intermediate_results": intermediate_results,
            "result": str(result) if result is not None else None,
            "result_reference": str(result_reference) if result_reference is not None else None,
            "measurement_error": (str(measurement_error) if measurement_error is not None else None),
            "unit": research_method["unit"],
            "conditions_info": conditions_info,
            "updated_input_data": input_data if is_mass_fraction_oil_method(research_method) else None,
        }
    )

    logger.debug(
        "Расчёт завершён: convergence={}, result={}, result_reference={}, measurement_error={}, unit={}",
        response.convergence,
        response.result,
        response.result_reference,
        response.measurement_error,
        response.unit,
    )
    return response
