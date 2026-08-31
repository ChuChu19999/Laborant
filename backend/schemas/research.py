from __future__ import annotations
from datetime import datetime
from typing import Annotated, Any, Literal
from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator
from models.research import RoundingType
from schemas.common import (
    MethodDataDefault,
    NonEmptyStr,
    OptionalNonEmptyStr,
    PositiveIntList,
    make_enum_validator,
)

_validate_rounding_type = make_enum_validator(RoundingType, "Тип округления")
RoundingTypeField = Annotated[str, AfterValidator(_validate_rounding_type)]
ResearchMethodGroupName = Annotated[NonEmptyStr, Field(max_length=255)]
SortOrderItemType = Literal["method", "group"]


def validate_sample_type(value: list[str]) -> list[str]:
    """Проверить, что указан хотя бы один тип пробы."""
    if not value:
        raise ValueError("Необходимо указать хотя бы один тип пробы")
    return value


def validate_measurement_error(value: dict[str, Any]) -> dict[str, Any]:
    """Проверить структуру погрешности измерения метода."""
    if not value:
        return {}
    if "type" not in value:
        raise ValueError("Не указан тип погрешности")
    if value["type"] not in ["fixed", "formula"]:
        raise ValueError("Неверный тип погрешности")
    if "value" not in value:
        raise ValueError("Не указано значение погрешности")
    if value["type"] == "fixed":
        try:
            float(value["value"])
        except (ValueError, TypeError):
            raise ValueError("Фиксированное значение должно быть числом") from None
    return value


def validate_input_data(value: dict[str, Any]) -> dict[str, Any]:
    """Проверить структуру входных данных метода исследования."""
    required_keys = {"fields"}
    if not all(key in value for key in required_keys):
        raise ValueError(f"Входные данные должны содержать следующие ключи: {required_keys}")
    for field in value.get("fields", []):
        if not isinstance(field, dict):
            raise ValueError("Каждое поле должно быть объектом")
        required_field_keys = {"name", "description", "card_index"}
        if not all(key in field for key in required_field_keys):
            raise ValueError(f"Каждое поле должно содержать следующие ключи: {required_field_keys}")
        if not isinstance(field["card_index"], int) or field["card_index"] < 1:
            raise ValueError("Поле card_index должно быть положительным целым числом")
        if "unit" in field and not isinstance(field["unit"], str):
            raise ValueError("Поле unit должно быть строкой")
    return value


def validate_intermediate_data(value: dict[str, Any]) -> dict[str, Any]:
    """Проверить структуру промежуточных данных метода исследования."""
    for field in value.get("fields", []):
        if not isinstance(field, dict):
            raise ValueError("Каждое поле должно быть объектом")
        required_field_keys = {"name", "formula", "description", "show_calculation"}
        if not all(key in field for key in required_field_keys):
            raise ValueError(f"Каждое поле должно содержать следующие ключи: {required_field_keys}")
        if "unit" in field and not isinstance(field["unit"], str):
            raise ValueError("Поле unit должно быть строкой")
        if not isinstance(field["show_calculation"], bool):
            raise ValueError("Поле show_calculation должно быть логическим значением")
        use_result_rounding = field.get("use_result_rounding", True)
        if use_result_rounding is not False and use_result_rounding is not True:
            raise ValueError("Поле use_result_rounding должно быть логическим значением")
        if field.get("use_result_rounding") is False:
            if field.get("use_multiple_rounding") or field.get("use_threshold_table"):
                raise ValueError("Своё округление нельзя задавать вместе с кратным или табличным")
            rounding_type = field.get("rounding_type")
            valid_types = [e.value for e in RoundingType]
            if rounding_type not in valid_types:
                raise ValueError(
                    f"Неверный тип округления промежуточного поля. Допустимые значения: {', '.join(valid_types)}"
                )
            if "rounding_decimal" not in field:
                raise ValueError("Для своего округления укажите rounding_decimal")
            if not isinstance(field["rounding_decimal"], int) or field["rounding_decimal"] < 0:
                raise ValueError("rounding_decimal должно быть неотрицательным целым")
    return value


def normalize_convergence_conditions(value: Any) -> dict[str, Any]:
    """Нормализовать условия повторяемости, допуская пустые значения для фракционного состава."""
    if isinstance(value, list):
        return {}
    if value is None:
        return {}
    if not isinstance(value, dict):
        return {}
    if not value:
        return {}
    if "formulas" not in value:
        return {}
    return value


def validate_convergence_conditions(value: dict[str, Any]) -> dict[str, Any]:
    """Проверить структуру условий повторяемости, допуская пустые значения."""
    if not value:
        return value

    if "formulas" not in value:
        raise ValueError("Условия повторяемости должны содержать ключ 'formulas'")
    if not isinstance(value["formulas"], list):
        raise ValueError("Формулы условий повторяемости должны быть списком")
    valid_convergence_values = [
        "satisfactory",
        "unsatisfactory",
        "absence",
        "traces",
        "custom",
    ]
    for formula_data in value["formulas"]:
        if not isinstance(formula_data, dict):
            raise ValueError("Каждое условие повторяемости должно быть словарем")
        if "formula" not in formula_data:
            raise ValueError("Каждое условие должно содержать поле 'formula'")
        if "convergence_value" not in formula_data:
            raise ValueError("Каждое условие должно содержать поле 'convergence_value'")
        if formula_data["convergence_value"] not in valid_convergence_values and not formula_data.get("custom_value"):
            raise ValueError(
                f"Значение повторяемости должно быть одним из: {', '.join(valid_convergence_values)} или иметь custom_value"
            )
    return value


def validate_method_ids(value: list[int]) -> list[int]:
    """Проверить, что выбран хотя бы один метод исследования."""
    if not value:
        raise ValueError("Необходимо выбрать хотя бы один метод")
    return value


class ResearchMethodBase(BaseModel):
    """Общие поля метода исследования."""

    name: Annotated[NonEmptyStr, Field(max_length=255)] = Field(..., description="Наименование метода исследования")
    sample_type: list[str] = Field(..., description="Типы исследуемых проб")
    formula: Annotated[NonEmptyStr, Field(max_length=255)] = Field(..., description="Формула для расчёта")
    measurement_error: dict[str, Any] = Field(..., description="Погрешность измерения")
    unit: Annotated[NonEmptyStr, Field(max_length=20)] = Field(..., description="Единица измерения результата")
    measurement_method: Annotated[NonEmptyStr, Field(max_length=255)] = Field(..., description="Метод измерения")
    nd_code: Annotated[NonEmptyStr, Field(max_length=255)] = Field(..., description="Шифр НД")
    nd_name: Annotated[NonEmptyStr, Field(max_length=255)] = Field(..., description="Наименование НД")
    input_data: dict[str, Any] = Field(..., description="Структура входных данных")
    intermediate_data: dict[str, Any] = Field(..., description="Структура промежуточных данных")
    convergence_conditions: dict[str, Any] = Field(
        default_factory=lambda: {"formulas": [{"formula": "", "convergence_value": "satisfactory"}]},
        description="Условия повторяемости",
    )
    rounding_type: RoundingTypeField = Field(..., description="Тип округления")
    rounding_decimal: int = Field(..., ge=0, description="Количество знаков округления")
    is_group_member: bool = Field(default=False, description="Является частью группы")
    equipment_data_default: MethodDataDefault = Field(
        default_factory=list,
        description="Приборы по умолчанию",
    )
    sort_order: int | None = Field(None, description="Порядок сортировки")
    laboratory_id: int | None = Field(None, description="ID лаборатории")
    department_id: int | None = Field(None, description="ID подразделения")

    @field_validator("sample_type")
    @classmethod
    def _validate_sample_type(cls, value: list[str]) -> list[str]:
        return validate_sample_type(value)

    @field_validator("measurement_error")
    @classmethod
    def _validate_measurement_error(cls, value: dict[str, Any]) -> dict[str, Any]:
        return validate_measurement_error(value)

    @field_validator("input_data")
    @classmethod
    def _validate_input_data(cls, value: dict[str, Any]) -> dict[str, Any]:
        return validate_input_data(value)

    @field_validator("intermediate_data")
    @classmethod
    def _validate_intermediate_data(cls, value: dict[str, Any]) -> dict[str, Any]:
        return validate_intermediate_data(value)

    @field_validator("convergence_conditions", mode="before")
    @classmethod
    def _normalize_convergence_conditions(cls, value: Any) -> dict[str, Any]:
        return normalize_convergence_conditions(value)

    @field_validator("convergence_conditions")
    @classmethod
    def _validate_convergence_conditions(cls, value: dict[str, Any]) -> dict[str, Any]:
        return validate_convergence_conditions(value)


class ResearchMethodCreate(ResearchMethodBase):
    """Запрос на создание метода исследования."""


class ResearchMethodUpdate(BaseModel):
    """Частичное обновление метода исследования."""

    name: OptionalNonEmptyStr = Field(None, max_length=255)
    sample_type: list[str] | None = None
    formula: OptionalNonEmptyStr = Field(None, max_length=255)
    measurement_error: dict[str, Any] | None = None
    unit: OptionalNonEmptyStr = Field(None, max_length=20)
    measurement_method: OptionalNonEmptyStr = Field(None, max_length=255)
    nd_code: OptionalNonEmptyStr = Field(None, max_length=255)
    nd_name: OptionalNonEmptyStr = Field(None, max_length=255)
    input_data: dict[str, Any] | None = None
    intermediate_data: dict[str, Any] | None = None
    convergence_conditions: dict[str, Any] | None = None
    rounding_type: RoundingTypeField | None = None
    rounding_decimal: int | None = Field(None, ge=0)
    is_group_member: bool | None = None
    equipment_data_default: PositiveIntList | None = None
    sort_order: int | None = None
    laboratory_id: int | None = None
    department_id: int | None = None

    @field_validator("sample_type")
    @classmethod
    def _validate_sample_type(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return validate_sample_type(value)

    @field_validator("measurement_error")
    @classmethod
    def _validate_measurement_error(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        if value is None:
            return None
        return validate_measurement_error(value)

    @field_validator("input_data")
    @classmethod
    def _validate_input_data(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        if value is None:
            return None
        return validate_input_data(value)

    @field_validator("intermediate_data")
    @classmethod
    def _validate_intermediate_data(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        if value is None:
            return None
        return validate_intermediate_data(value)

    @field_validator("convergence_conditions", mode="before")
    @classmethod
    def _normalize_convergence_conditions(cls, value: Any) -> dict[str, Any] | None:
        if value is None:
            return None
        return normalize_convergence_conditions(value)

    @field_validator("convergence_conditions")
    @classmethod
    def _validate_convergence_conditions(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        if value is None:
            return None
        return validate_convergence_conditions(value)


class ResearchMethodGroupBase(BaseModel):
    """Общие поля группы методов исследования."""

    name: ResearchMethodGroupName = Field(..., description="Наименование группы методов исследования")
    sort_order: int | None = Field(None, description="Порядок сортировки группы")


class ResearchMethodGroupCreate(ResearchMethodGroupBase):
    """Запрос на создание группы методов исследования."""

    method_ids: PositiveIntList = Field(..., min_length=1, description="ID методов исследования")

    @field_validator("method_ids")
    @classmethod
    def _validate_method_ids(cls, value: list[int]) -> list[int]:
        return validate_method_ids(value)


class ResearchMethodGroupUpdate(BaseModel):
    """Частичное обновление группы методов исследования."""

    name: OptionalNonEmptyStr = Field(None, max_length=255)
    method_ids: PositiveIntList | None = None
    sort_order: int | None = None

    @field_validator("method_ids")
    @classmethod
    def _validate_method_ids(cls, value: list[int] | None) -> list[int] | None:
        if value is None:
            return None
        return validate_method_ids(value)


class ResearchMethodBrief(BaseModel):
    """Краткие сведения о методе в составе группы."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class ResearchMethodGroupBrief(BaseModel):
    """Краткие сведения о группе методов в составе метода."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    deleted_at: datetime | None = None


class ResearchMethodGroupResponse(ResearchMethodGroupBase):
    """Ответ API с данными группы методов исследования."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    methods: list[ResearchMethodBrief] = []
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class ResearchMethodResponse(ResearchMethodBase):
    """Ответ API с данными метода исследования."""

    model_config = ConfigDict(from_attributes=True)

    unit: str = Field(..., max_length=20, description="Единица измерения результата")
    id: int
    groups: list[ResearchMethodGroupBrief] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class ResearchMethodSortOrderUpdate(BaseModel):
    """Запрос на изменение порядка сортировки метода."""

    sort_order: int = Field(..., description="Новый порядок сортировки")


class SortOrderBatchUpdateItem(BaseModel):
    """Элемент пакетного обновления порядка сортировки."""

    id: int = Field(..., description="ID элемента")
    type: SortOrderItemType = Field(..., description="Тип элемента: method или group")
    sort_order: int = Field(..., description="Новый порядок сортировки")


class SortOrderBatchUpdate(BaseModel):
    """Пакетное обновление порядка сортировки методов и групп."""

    items: list[SortOrderBatchUpdateItem] = Field(..., min_length=1, description="Список элементов для обновления")


class SortOrderBatchUpdateResponse(BaseModel):
    """Результат пакетного обновления порядка сортировки."""

    message: str = Field(..., description="Текстовый статус операции")


class AvailableResearchMethodBrief(BaseModel):
    """Краткое описание метода внутри группы для селекта."""

    id: int = Field(..., description="ID метода исследования")
    name: str = Field(..., description="Наименование метода исследования")
    sort_order: int = Field(..., description="Порядок сортировки")
    input_data: dict[str, Any] = Field(..., description="Структура входных данных")
    intermediate_data: dict[str, Any] = Field(..., description="Структура промежуточных данных")
    unit: str = Field(..., description="Единица измерения результата")
    equipment_data_default: list[int] | None = Field(None, description="Приборы по умолчанию")


class AvailableResearchMethodEntry(BaseModel):
    """Группа или одиночный метод в селекте доступных методик."""

    id: int | str = Field(..., description="ID метода или группы (group_{id})")
    name: str = Field(..., description="Наименование метода или группы")
    sort_order: int = Field(..., description="Порядок сортировки")
    is_group: bool = Field(..., description="Является ли элемент группой методов")
    group_id: int | None = Field(None, description="ID группы методов")
    methods: list[AvailableResearchMethodBrief] | None = Field(None, description="Методы внутри группы")
    input_data: dict[str, Any] | None = Field(None, description="Структура входных данных для отдельного метода")
    intermediate_data: dict[str, Any] | None = Field(
        None, description="Структура промежуточных данных для отдельного метода"
    )
    unit: str | None = Field(None, description="Единица измерения результата")
    equipment_data_default: list[int] | None = Field(None, description="Приборы по умолчанию")


class AvailableResearchMethodsResponse(BaseModel):
    """Ответ со списком доступных методов исследования для селекта."""

    methods: list[AvailableResearchMethodEntry] = Field(..., description="Доступные методы и группы методов")
