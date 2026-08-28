from __future__ import annotations
from typing import Any
from core.exceptions import DomainValidationError
from core.logger import logger
from schemas.calculation import CalculateResponse
from services.calculation.chloride_salts import (
    apply_chloride_result_display_to_response,
    is_chloride_salts_method,
    resolve_chloride_custom_result_text,
)
from services.calculation.intermediate import (
    CALC_ERRORS,
    build_rounded_intermediate_display,
    build_variables_rounded_chain,
    filter_intermediate_results_for_display,
)
from services.calculation.mass_fraction_oil import (
    is_mass_fraction_oil_method,
    log_skip_repeatability_div_by_sum,
    resolve_custom_result_text as resolve_mf_oil_custom_result_text,
    should_skip_repeatability_div_by_sum,
)
from utils.calculation.engine import calculate_convergence_steps, evaluate_formula


def _convergence_formulas(research_method: dict[str, Any]) -> list[dict[str, Any]]:
    """Вернуть формулы проверки повторяемости из методики."""
    raw = (research_method.get("convergence_conditions") or {}).get("formulas") or []
    return [condition for condition in raw if isinstance(condition, dict)]


def evaluate_convergence(
    research_method: dict[str, Any],
    variables_rounded: dict[str, Any],
) -> tuple[str, str | None, list[dict[str, Any]]]:
    """Проверить повторяемость и выбрать исход по приоритету условий."""
    formulas = _convergence_formulas(research_method)
    cached: dict[int, tuple[str, bool, Any]] = {}
    satisfied_conditions: list[str] = []

    logger.debug("Проверка повторяемости, условий={}", len(formulas))
    for condition in formulas:
        formula = str(condition.get("formula") or "").strip()
        convergence_value = condition.get("convergence_value")
        if not formula or not convergence_value:
            continue
        try:
            if should_skip_repeatability_div_by_sum(research_method, variables_rounded, condition):
                if convergence_value == "satisfactory":
                    satisfied_conditions.append("satisfactory")
                    log_skip_repeatability_div_by_sum()
                cached[id(condition)] = ("skip", True, [])
                logger.debug("Условие пропущено (skip): formula={}, type={}", formula, convergence_value)
                continue

            condition_result = bool(evaluate_formula(formula, variables_rounded, is_condition=True))
            logger.debug(
                "Условие: formula={}, result={}, type={}",
                formula,
                condition_result,
                convergence_value,
            )
            if condition_result:
                satisfied_conditions.append(convergence_value)
            cached[id(condition)] = (
                "ok",
                condition_result,
                calculate_convergence_steps(formula, variables_rounded),
            )
        except CALC_ERRORS as e:
            logger.error("Ошибка при проверке условия повторяемости: {}", e)
            raise DomainValidationError(f"Ошибка при проверке условия повторяемости: {e!s}") from e

    convergence_result = "satisfactory"
    custom_value: str | None = None
    for condition in formulas:
        if condition.get("convergence_value") != "custom" or not condition.get("custom_value"):
            continue
        formula = str(condition.get("formula") or "").strip()
        if not formula:
            continue
        entry = cached.get(id(condition))
        try:
            if entry is not None and entry[0] == "ok":
                condition_result = entry[1]
            else:
                condition_result = bool(evaluate_formula(formula, variables_rounded, is_condition=True))
            if condition_result:
                convergence_result = "custom"
                custom_value = condition["custom_value"]
                break
        except CALC_ERRORS as e:
            logger.error("Ошибка при проверке особого условия: {}", e)
            continue

    if convergence_result != "custom":
        if "absence" in satisfied_conditions:
            convergence_result = "absence"
        elif "traces" in satisfied_conditions:
            convergence_result = "traces"
        elif "unsatisfactory" in satisfied_conditions:
            convergence_result = "unsatisfactory"

    logger.debug(
        "Итог повторяемости: result={}, custom_value={}, satisfied={}",
        convergence_result,
        custom_value,
        satisfied_conditions,
    )

    conditions_info: list[dict[str, Any]] = []
    for condition in formulas:
        formula = str(condition.get("formula") or "").strip()
        convergence_value = condition.get("convergence_value")
        if convergence_value != convergence_result or not formula:
            continue
        try:
            entry = cached.get(id(condition))
            if entry is not None:
                kind, satisfied, steps = entry
                conditions_info.append(
                    {
                        "formula": formula,
                        "satisfied": True if kind == "skip" else satisfied,
                        "convergence_value": convergence_value,
                        "calculation_steps": [] if kind == "skip" else steps,
                    }
                )
                continue

            if should_skip_repeatability_div_by_sum(research_method, variables_rounded, condition):
                conditions_info.append(
                    {
                        "formula": formula,
                        "satisfied": True,
                        "convergence_value": convergence_value,
                        "calculation_steps": [],
                    }
                )
                continue
            condition_result = bool(evaluate_formula(formula, variables_rounded, is_condition=True))
            conditions_info.append(
                {
                    "formula": formula,
                    "satisfied": condition_result,
                    "convergence_value": convergence_value,
                    "calculation_steps": calculate_convergence_steps(formula, variables_rounded),
                }
            )
        except CALC_ERRORS as e:
            logger.error("Ошибка при проверке условия повторяемости: {}", e)
            raise DomainValidationError(f"Ошибка при проверке условия повторяемости: {e!s}") from e

    return convergence_result, custom_value, conditions_info


def build_early_convergence_response(
    *,
    input_data: dict[str, Any],
    research_method: dict[str, Any],
    intermediate_values_by_name: dict[str, dict[str, Any]],
    intermediate_results_unrounded: dict[str, Any],
    convergence_result: str,
    custom_value: str | None,
    conditions_info: list[dict[str, Any]],
) -> CalculateResponse:
    """Собрать ответ без основного числового результата."""
    result_text: str | None = None
    if convergence_result == "custom":
        result_text = custom_value.lower() if custom_value else None
    elif convergence_result == "absence":
        result_text = "отсутствие"
    elif convergence_result == "traces":
        result_text = "следы"
    elif convergence_result == "unsatisfactory":
        result_text = "неудовлетворительно"

    early_result_places = None
    if research_method["rounding_type"] == "decimal":
        early_result_places = research_method["rounding_decimal"]

    variables_rounded_early = build_variables_rounded_chain(
        input_data,
        research_method,
        intermediate_values_by_name,
        early_result_places,
    )
    intermediate_results_rounded = build_rounded_intermediate_display(
        intermediate_results_unrounded,
        variables_rounded_early,
        intermediate_values_by_name,
        research_method,
        early_result_places,
    )

    chloride_result_text = resolve_chloride_custom_result_text(
        research_method,
        convergence_result,
        custom_value,
        intermediate_results_rounded,
        input_data,
    )
    if chloride_result_text is not None:
        result_text = chloride_result_text

    mf_oil_result_text = resolve_mf_oil_custom_result_text(
        research_method,
        custom_value,
        intermediate_results_rounded,
    )
    if mf_oil_result_text is not None:
        result_text = mf_oil_result_text

    response_data_early: dict[str, Any] = {
        "convergence": convergence_result,
        "intermediate_results": filter_intermediate_results_for_display(
            intermediate_results_rounded, intermediate_values_by_name
        ),
        "result": result_text,
        "result_reference": None,
        "measurement_error": None,
        "unit": research_method["unit"],
        "conditions_info": conditions_info,
    }

    apply_chloride_result_display_to_response(response_data_early, input_data)

    if is_mass_fraction_oil_method(research_method) or is_chloride_salts_method(research_method):
        response_data_early["updated_input_data"] = input_data

    logger.debug(
        "Ответ без числового итога: convergence={}, result={}",
        convergence_result,
        result_text,
    )
    return CalculateResponse.model_validate(response_data_early)


__all__ = [
    "build_early_convergence_response",
    "evaluate_convergence",
]
