from __future__ import annotations
from typing import Any
from utils.calculation.result_display import (
    CHLORIDE_SALTS_RESULT_DISPLAY_KEY,
    format_xsr_display,
    is_chloride_salts_method_name,
)


def is_chloride_salts_method(research_method: dict[str, Any]) -> bool:
    """Проверить, что методика — массовая концентрация хлористых солей."""
    return is_chloride_salts_method_name(research_method.get("name"))


def clear_chloride_salts_result_display(input_data: dict[str, Any]) -> None:
    """Удалить из входных данных сохранённый текст результата перед новым расчётом."""
    input_data.pop(CHLORIDE_SALTS_RESULT_DISPLAY_KEY, None)


def resolve_chloride_custom_result_text(
    research_method: dict[str, Any],
    convergence_result: str,
    custom_value: str | None,
    intermediate_results_rounded: dict[str, Any],
    input_data: dict[str, Any],
) -> str | None:
    """Сохранить текст условия во входных данных и вернуть числовой Xср как итог расчёта."""
    if not is_chloride_salts_method(research_method):
        return None
    if convergence_result != "custom" or not custom_value:
        return None

    numeric_xsr = format_xsr_display(intermediate_results_rounded)
    if numeric_xsr is None:
        return None

    input_data[CHLORIDE_SALTS_RESULT_DISPLAY_KEY] = str(custom_value).strip()
    return numeric_xsr


def apply_chloride_result_display_to_response(
    response_data: dict[str, Any],
    input_data: dict[str, Any],
) -> None:
    """Подставить сохранённый текст условия в поле result_display ответа."""
    chloride_display = input_data.get(CHLORIDE_SALTS_RESULT_DISPLAY_KEY)
    if chloride_display is not None and str(chloride_display).strip():
        response_data["result_display"] = str(chloride_display).strip()
