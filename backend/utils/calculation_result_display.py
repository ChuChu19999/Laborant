from typing import Any

CHLORIDE_SALTS_METHOD_NAME = "Массовая концентрация хлористых солей"
CHLORIDE_SALTS_RESULT_DISPLAY_KEY = "_chloride_salts_result_display"


def is_chloride_salts_method_name(name: str | None) -> bool:
    return (name or "").strip() == CHLORIDE_SALTS_METHOD_NAME


def get_chloride_salts_result_display(input_data: Any) -> str | None:
    if not isinstance(input_data, dict):
        return None
    label = input_data.get(CHLORIDE_SALTS_RESULT_DISPLAY_KEY)
    if label is None:
        return None
    text = str(label).strip()
    return text or None


def format_calculation_result_for_display(
    result: Any,
    method_name: str | None,
    input_data: Any,
) -> str:
    """Числовой итог из БД подменяется подписью условия повторяемости, если она сохранена."""
    label = get_chloride_salts_result_display(input_data)
    if label and is_chloride_salts_method_name(method_name):
        return label
    if result is None:
        return ""
    return str(result)
