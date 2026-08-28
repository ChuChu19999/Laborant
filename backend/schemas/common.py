from __future__ import annotations
from enum import Enum
import re
from typing import Annotated, Any
from pydantic import AfterValidator, BeforeValidator, Field


def strip_non_empty(value: str) -> str:
    """Удалить пробелы и отклонить пустую строку."""
    if not value or not value.strip():
        raise ValueError("Поле не может быть пустым")
    return value.strip()


def strip_optional_non_empty(value: Any) -> Any:
    """Удалить пробелы у необязательной строки, отклоняя пустое значение."""
    if value is None:
        return value
    if not str(value).strip():
        raise ValueError("Поле не может быть пустым")
    return str(value).strip()


NonEmptyStr = Annotated[str, AfterValidator(strip_non_empty)]
# max_length задавать через Field(..., max_length=N) на поле, не Annotated[..., Field(max_length=N)]:
# иначе Pydantic применяет max_length к None и падает при сериализации Response.
OptionalNonEmptyStr = Annotated[str | None, BeforeValidator(strip_optional_non_empty)]


def validate_positive_int_list(value: list[int]) -> list[int]:
    """Проверить, что все элементы списка — положительные целые ID."""
    for item in value:
        if item <= 0:
            raise ValueError("Каждый ID должен быть положительным целым числом")
    return value


PositiveIntList = Annotated[list[int], AfterValidator(validate_positive_int_list)]


def normalize_method_data_default(value: list[int] | None) -> list[int]:
    """Привести список ID методов по умолчанию к списку положительных чисел."""
    if value is None:
        return []
    return validate_positive_int_list(value)


MethodDataDefault = Annotated[
    list[int],
    BeforeValidator(normalize_method_data_default),
    Field(default_factory=list),
]


def make_enum_validator(enum_class: type[Enum], field_label: str):
    """Создать валидатор строкового поля по допустимым значениям Enum."""
    valid_types = [item.value for item in enum_class]

    def validator(value: str) -> str:
        if value not in valid_types:
            raise ValueError(f"{field_label} должен быть одним из: {', '.join(valid_types)}")
        return value

    return validator


def validate_oil_mass_fraction_c_value(value: str) -> str:
    """Проверить массовую долю нефти в диапазоне от 0 до 100."""
    try:
        c_float = float(value)
    except (TypeError, ValueError):
        raise ValueError("Массовая доля нефти должна быть числом") from None
    if c_float < 0 or c_float > 100:
        raise ValueError("Массовая доля нефти должна быть в диапазоне от 0 до 100")
    return value


def validate_optional_oil_mass_fraction_c_value(value: Any) -> Any:
    """Проверить необязательную массовую долю нефти в диапазоне от 0 до 100."""
    if value is None:
        return None
    return validate_oil_mass_fraction_c_value(str(value))


OilMassFractionCValue = Annotated[str, AfterValidator(validate_oil_mass_fraction_c_value)]
OptionalOilMassFractionCValue = Annotated[
    str | None,
    BeforeValidator(validate_optional_oil_mass_fraction_c_value),
]


def validate_oil_mass_fraction_n_value(value: str) -> str:
    """Нормализовать и проверить показатель преломления как число."""
    if not value or not str(value).strip():
        raise ValueError("Показатель преломления не может быть пустым")
    normalized = str(value).strip().replace(",", ".")
    try:
        float(normalized)
    except (TypeError, ValueError):
        raise ValueError("Показатель преломления должен быть числом") from None
    return normalized


def validate_optional_oil_mass_fraction_n_value(value: Any) -> Any:
    """Нормализовать и проверить необязательный показатель преломления."""
    if value is None:
        return None
    return validate_oil_mass_fraction_n_value(str(value))


OilMassFractionNValue = Annotated[str, AfterValidator(validate_oil_mass_fraction_n_value)]
OptionalOilMassFractionNValue = Annotated[
    str | None,
    BeforeValidator(validate_optional_oil_mass_fraction_n_value),
]


def validate_executor_hsnils(value: str) -> str:
    """Проверить и нормализовать hsnils исполнителя как 32-символьную hex-строку."""
    if not value or not value.strip():
        raise ValueError("Необходимо указать hsnils исполнителя")
    normalized = value.strip().lower()
    if not re.fullmatch(r"[0-9a-f]{32}", normalized):
        raise ValueError("Некорректный формат hsnils исполнителя (ожидается 32-символьная hex-строка)")
    return normalized


def validate_optional_executor_hsnils(value: Any) -> Any:
    """Проверить необязательный hsnils исполнителя как 32-символьную hex-строку."""
    if value is None:
        return value
    return validate_executor_hsnils(str(value))


ExecutorHsnils = Annotated[str, AfterValidator(validate_executor_hsnils)]
OptionalExecutorHsnils = Annotated[
    str | None,
    BeforeValidator(validate_optional_executor_hsnils),
]


def related_entity_name(relation: Any) -> str | None:
    """Вернуть name связанной ORM-сущности для @computed_field в Response."""
    if relation is None:
        return None
    name = getattr(relation, "name", None)
    return str(name) if name is not None else None


def related_entity_phone(relation: Any) -> str | None:
    """Вернуть phone связанной ORM-сущности для @computed_field в Response."""
    if relation is None:
        return None
    phone = getattr(relation, "phone", None)
    return str(phone) if phone is not None else None


def active_related_count(relations: Any) -> int:
    """Вернуть число связанных записей без deleted_at для @computed_field в Response."""
    if not relations:
        return 0
    return len([item for item in relations if getattr(item, "deleted_at", None) is None])


def validate_selection_conditions(value: list[dict[str, str]]) -> list[dict[str, str]]:
    """Проверить структуру списка условий отбора пробы."""
    for condition in value:
        if not all(key in condition for key in ["variable", "unit"]):
            raise ValueError("Каждое условие должно содержать поля 'variable' и 'unit'")
        if len(condition.keys()) > 2:
            raise ValueError("Каждое условие должно содержать только поля 'variable' и 'unit'")
    return value


def validate_optional_selection_conditions(value: Any) -> Any:
    """Проверить необязательный список условий отбора пробы."""
    if value is None:
        return None
    return validate_selection_conditions(value)


SelectionConditionsList = Annotated[list[dict[str, str]], AfterValidator(validate_selection_conditions)]
OptionalSelectionConditionsList = Annotated[
    list[dict[str, str]] | None,
    BeforeValidator(validate_optional_selection_conditions),
]


def validate_optional_protocol_abbreviation(value: Any) -> str | None:
    """Проверить и нормализовать необязательную аббревиатуру протокола."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if len(text) > 8:
        raise ValueError("Аббревиатура для протокола не должна превышать 8 символов")
    return text


OptionalProtocolAbbreviation = Annotated[str | None, BeforeValidator(validate_optional_protocol_abbreviation)]
