from __future__ import annotations
from typing import Any, Dict, Optional
from utils.calculation_result_display import (
    CHLORIDE_SALTS_RESULT_DISPLAY_KEY,
    is_chloride_salts_method_name,
)


def is_chloride_salts_input_key(key: Any) -> bool:
    return key == CHLORIDE_SALTS_RESULT_DISPLAY_KEY


def is_chloride_salts_method(research_method: Dict[str, Any]) -> bool:
    return is_chloride_salts_method_name(research_method.get("name"))


def prepare_chloride_salts_input(input_data: Dict[str, Any]) -> None:
    input_data.pop(CHLORIDE_SALTS_RESULT_DISPLAY_KEY, None)


def xsr_display_value(
    intermediate_results_rounded: Dict[str, Any],
) -> Optional[str]:
    """Округлённое Xср."""
    xsr_entry = intermediate_results_rounded.get("Xср")
    if isinstance(xsr_entry, dict):
        value = xsr_entry.get("value")
    else:
        value = xsr_entry
    if value is None:
        return None
    return str(value).replace(".", ",")


def apply_custom_early_result(
    research_method: Dict[str, Any],
    convergence_result: str,
    custom_value: Optional[str],
    intermediate_results_rounded: Dict[str, Any],
    input_data: Dict[str, Any],
) -> Optional[str]:
    """При custom-повторяемости: в result — число Xср, подпись условия — в input_data."""
    if not is_chloride_salts_method(research_method):
        return None
    if convergence_result != "custom" or not custom_value:
        return None

    numeric_xsr = xsr_display_value(intermediate_results_rounded)
    if numeric_xsr is None:
        return None

    input_data[CHLORIDE_SALTS_RESULT_DISPLAY_KEY] = str(custom_value).strip()
    return numeric_xsr


def enrich_early_response(
    response_data: Dict[str, Any],
    input_data: Dict[str, Any],
) -> None:
    chloride_display = input_data.get(CHLORIDE_SALTS_RESULT_DISPLAY_KEY)
    if chloride_display is not None and str(chloride_display).strip():
        response_data["result_display"] = str(chloride_display).strip()
