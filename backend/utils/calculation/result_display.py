from __future__ import annotations
from typing import Any

CHLORIDE_SALTS_METHOD_NAME = "Массовая концентрация хлористых солей"
CHLORIDE_SALTS_RESULT_DISPLAY_KEY = "_chloride_salts_result_display"


def is_chloride_salts_method_name(name: str | None) -> bool:
    """Проверить, что имя метода — хлористые соли."""
    return (name or "").strip() == CHLORIDE_SALTS_METHOD_NAME


def is_chloride_salts_input_key(key: Any) -> bool:
    """Проверить ключ подписи результата хлористых солей во входных данных."""
    return key == CHLORIDE_SALTS_RESULT_DISPLAY_KEY


def get_chloride_salts_result_display(input_data: Any) -> str | None:
    """Вернуть подпись условия хлористых солей из input_data, если есть."""
    if not isinstance(input_data, dict):
        return None
    label = input_data.get(CHLORIDE_SALTS_RESULT_DISPLAY_KEY)
    if label is None:
        return None
    text = str(label).strip()
    return text or None


def format_xsr_display(intermediate_results_rounded: dict[str, Any]) -> str | None:
    """Вернуть округлённый Xср строкой с десятичной запятой."""
    xsr_entry = intermediate_results_rounded.get("Xср")
    value = xsr_entry.get("value") if isinstance(xsr_entry, dict) else xsr_entry
    if value is None:
        return None
    return str(value).replace(".", ",")


def format_calculation_result_display(
    result: Any,
    method_name: str | None,
    input_data: Any,
) -> str:
    """Для хлористых солей показать подпись условия вместо числа из БД."""
    label = get_chloride_salts_result_display(input_data)
    if label and is_chloride_salts_method_name(method_name):
        return label
    if result is None:
        return ""
    return str(result)
