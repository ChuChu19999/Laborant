from __future__ import annotations
import re
from enum import Enum
from typing import Annotated, Any
from pydantic import AfterValidator, BeforeValidator, Field


def strip_non_empty(value: str) -> str:
    if not value or not value.strip():
        raise ValueError("Поле не может быть пустым")
    return value.strip()


def strip_optional_non_empty(value: Any) -> Any:
    if value is None:
        return value
    if not str(value).strip():
        raise ValueError("Поле не может быть пустым")
    return str(value).strip()


NonEmptyStr = Annotated[str, AfterValidator(strip_non_empty)]
OptionalNonEmptyStr = Annotated[str | None, BeforeValidator(strip_optional_non_empty)]


def validate_positive_int_list(value: list[int]) -> list[int]:
    for item in value:
        if not isinstance(item, int) or item <= 0:
            raise ValueError("Каждый ID должен быть положительным целым числом")
    return value


PositiveIntList = Annotated[list[int], AfterValidator(validate_positive_int_list)]


def normalize_method_data_default(value: list[int] | None) -> list[int]:
    if value is None:
        return []
    return validate_positive_int_list(value)


MethodDataDefault = Annotated[
    list[int],
    BeforeValidator(normalize_method_data_default),
    Field(default_factory=list),
]


def make_enum_validator(enum_class: type[Enum], field_label: str):
    valid_types = [item.value for item in enum_class]

    def validator(value: str) -> str:
        if value not in valid_types:
            raise ValueError(
                f"{field_label} должен быть одним из: {', '.join(valid_types)}"
            )
        return value

    return validator


def validate_oil_mass_fraction_c_value(value: str) -> str:
    try:
        c_float = float(value)
    except (TypeError, ValueError):
        raise ValueError("Массовая доля нефти должна быть числом")
    if c_float < 0 or c_float > 100:
        raise ValueError("Массовая доля нефти должна быть в диапазоне от 0 до 100")
    return value


def validate_optional_oil_mass_fraction_c_value(value: Any) -> Any:
    if value is None:
        return None
    return validate_oil_mass_fraction_c_value(str(value))


OilMassFractionCValue = Annotated[
    str, AfterValidator(validate_oil_mass_fraction_c_value)
]
OptionalOilMassFractionCValue = Annotated[
    str | None,
    BeforeValidator(validate_optional_oil_mass_fraction_c_value),
]


def validate_executor_hsnils(value: str) -> str:
    if not value or not value.strip():
        raise ValueError("Необходимо указать hsnils исполнителя")
    normalized = value.strip().lower()
    if not re.fullmatch(r"[0-9a-f]{32}", normalized):
        raise ValueError(
            "Некорректный формат hsnils исполнителя (ожидается 32-символьная hex-строка)"
        )
    return normalized


def validate_optional_executor_hsnils(value: Any) -> Any:
    if value is None:
        return value
    return validate_executor_hsnils(str(value))


ExecutorHsnils = Annotated[str, AfterValidator(validate_executor_hsnils)]
OptionalExecutorHsnils = Annotated[
    str | None,
    BeforeValidator(validate_optional_executor_hsnils),
]
