from __future__ import annotations
from datetime import datetime
from typing import Annotated, Any
from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator
from models.research import RoundingType
from schemas.common import NonEmptyStr, OptionalNonEmptyStr, make_enum_validator

_validate_rounding_type = make_enum_validator(RoundingType, "Тип округления")
RoundingTypeField = Annotated[str, AfterValidator(_validate_rounding_type)]
ResearchMethodGroupName = Annotated[NonEmptyStr, Field(max_length=255)]


class ResearchMethodBase(BaseModel):
    name: str = Field(
        ..., max_length=255, description="Наименование метода исследования"
    )
    sample_type: list[str] = Field(..., description="Типы исследуемых проб")
    formula: str = Field(..., max_length=255, description="Формула для расчета")
    measurement_error: dict[str, Any] = Field(..., description="Погрешность измерения")
    unit: str = Field(..., max_length=20, description="Единица измерения результата")
    measurement_method: str = Field(..., max_length=255, description="Метод измерения")
    nd_code: str = Field(..., max_length=255, description="Шифр НД")
    nd_name: str = Field(..., max_length=255, description="Наименование НД")
    input_data: dict[str, Any] = Field(..., description="Структура входных данных")
    intermediate_data: dict[str, Any] = Field(
        ..., description="Структура промежуточных данных"
    )
    convergence_conditions: dict[str, Any] = Field(
        default_factory=lambda: {
            "formulas": [{"formula": "", "convergence_value": "satisfactory"}]
        },
        description="Условия повторяемости",
    )
    rounding_type: RoundingTypeField = Field(..., description="Тип округления")
    rounding_decimal: int = Field(..., ge=0, description="Количество знаков округления")
    is_group_member: bool = Field(default=False, description="Является частью группы")
    equipment_data_default: list[int] | None = Field(
        None, description="Приборы по умолчанию"
    )
    sort_order: int | None = Field(None, description="Порядок сортировки")
    laboratory_id: int | None = Field(None, description="ID лаборатории")
    department_id: int | None = Field(None, description="ID подразделения")

    @field_validator("equipment_data_default")
    @classmethod
    def validate_equipment_data_default(
        cls, value: list[int] | None
    ) -> list[int] | None:
        if value is None:
            return []
        for item in value:
            if item <= 0:
                raise ValueError(
                    "Каждый ID прибора должен быть положительным целым числом"
                )
        return value

    @field_validator("measurement_error")
    @classmethod
    def validate_measurement_error(cls, value: dict[str, Any]) -> dict[str, Any]:
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
                raise ValueError("Фиксированное значение должно быть числом")
        return value

    @field_validator("input_data")
    @classmethod
    def validate_input_data(cls, value: dict[str, Any]) -> dict[str, Any]:
        required_keys = {"fields"}
        if not all(key in value for key in required_keys):
            raise ValueError(
                f"Входные данные должны содержать следующие ключи: {required_keys}"
            )
        for field in value.get("fields", []):
            if not isinstance(field, dict):
                raise ValueError("Каждое поле должно быть объектом")
            required_field_keys = {"name", "description", "card_index"}
            if not all(key in field for key in required_field_keys):
                raise ValueError(
                    f"Каждое поле должно содержать следующие ключи: {required_field_keys}"
                )
            if not isinstance(field["card_index"], int) or field["card_index"] < 1:
                raise ValueError(
                    "Поле card_index должно быть положительным целым числом"
                )
            if "unit" in field and not isinstance(field["unit"], str):
                raise ValueError("Поле unit должно быть строкой")
        return value

    @field_validator("intermediate_data")
    @classmethod
    def validate_intermediate_data(cls, value: dict[str, Any]) -> dict[str, Any]:
        for field in value.get("fields", []):
            if not isinstance(field, dict):
                raise ValueError("Каждое поле должно быть объектом")
            required_field_keys = {"name", "formula", "description", "show_calculation"}
            if not all(key in field for key in required_field_keys):
                raise ValueError(
                    f"Каждое поле должно содержать следующие ключи: {required_field_keys}"
                )
            if "unit" in field and not isinstance(field["unit"], str):
                raise ValueError("Поле unit должно быть строкой")
            if not isinstance(field["show_calculation"], bool):
                raise ValueError(
                    "Поле show_calculation должно быть логическим значением"
                )
            use_result_rounding = field.get("use_result_rounding", True)
            if use_result_rounding is not False and use_result_rounding is not True:
                raise ValueError(
                    "Поле use_result_rounding должно быть логическим значением"
                )
            if field.get("use_result_rounding") is False:
                if field.get("use_multiple_rounding") or field.get(
                    "use_threshold_table"
                ):
                    raise ValueError(
                        "Своё округление нельзя задавать вместе с кратным или табличным"
                    )
                rounding_type = field.get("rounding_type")
                valid_types = [e.value for e in RoundingType]
                if rounding_type not in valid_types:
                    raise ValueError(
                        f"Неверный тип округления промежуточного поля. "
                        f"Допустимые значения: {', '.join(valid_types)}"
                    )
                if "rounding_decimal" not in field:
                    raise ValueError("Для своего округления укажите rounding_decimal")
                if (
                    not isinstance(field["rounding_decimal"], int)
                    or field["rounding_decimal"] < 0
                ):
                    raise ValueError(
                        "rounding_decimal должно быть неотрицательным целым"
                    )
        return value

    @field_validator("convergence_conditions", mode="before")
    @classmethod
    def normalize_convergence_conditions(cls, value: Any) -> dict[str, Any]:
        """Нормализует convergence_conditions, разрешая пустые значения для фракционного состава."""
        # Если это список (пустой или нет), преобразуем в пустой словарь
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

    @field_validator("convergence_conditions")
    @classmethod
    def validate_convergence_conditions(cls, value: dict[str, Any]) -> dict[str, Any]:
        """Валидирует структуру convergence_conditions, разрешая пустые значения."""
        # Пустой словарь разрешен (особенность фракционного состава)
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
                raise ValueError(
                    "Каждое условие должно содержать поле 'convergence_value'"
                )
            if formula_data[
                "convergence_value"
            ] not in valid_convergence_values and not formula_data.get("custom_value"):
                raise ValueError(
                    f"Значение повторяемости должно быть одним из: {', '.join(valid_convergence_values)} или иметь custom_value"
                )
        return value


class ResearchMethodCreate(ResearchMethodBase):
    pass


class ResearchMethodUpdate(BaseModel):
    name: Annotated[OptionalNonEmptyStr, Field(max_length=255)] = None
    sample_type: list[str] | None = None
    formula: str | None = Field(None, max_length=255)
    measurement_error: dict[str, Any] | None = None
    unit: str | None = Field(None, max_length=20)
    measurement_method: str | None = Field(None, max_length=255)
    nd_code: str | None = Field(None, max_length=255)
    nd_name: str | None = Field(None, max_length=255)
    input_data: dict[str, Any] | None = None
    intermediate_data: dict[str, Any] | None = None
    convergence_conditions: dict[str, Any] | None = None
    rounding_type: RoundingTypeField | None = None
    rounding_decimal: int | None = Field(None, ge=0)
    is_group_member: bool | None = None
    equipment_data_default: list[int] | None = None
    sort_order: int | None = None
    laboratory_id: int | None = None
    department_id: int | None = None

    @field_validator("equipment_data_default")
    @classmethod
    def validate_equipment_data_default(
        cls, value: list[int] | None
    ) -> list[int] | None:
        if value is None:
            return None
        for item in value:
            if item <= 0:
                raise ValueError(
                    "Каждый ID прибора должен быть положительным целым числом"
                )
        return value

    @field_validator("sample_type")
    @classmethod
    def validate_sample_type(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        if not value:
            raise ValueError("Необходимо указать хотя бы один тип пробы")
        return value


class ResearchMethodGroupBase(BaseModel):
    name: ResearchMethodGroupName = Field(
        ..., description="Наименование группы методов исследования"
    )
    sort_order: int | None = Field(None, description="Порядок сортировки группы")


class ResearchMethodGroupCreate(ResearchMethodGroupBase):
    method_ids: list[int] = Field(
        ..., min_length=1, description="ID методов исследования"
    )

    @field_validator("method_ids")
    @classmethod
    def validate_method_ids(cls, value: list[int]) -> list[int]:
        if not value:
            raise ValueError("Необходимо выбрать хотя бы один метод")
        return value


class ResearchMethodGroupUpdate(BaseModel):
    name: Annotated[OptionalNonEmptyStr, Field(max_length=255)] = None
    method_ids: list[int] | None = None
    sort_order: int | None = None


class ResearchMethodBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class ResearchMethodGroupResponse(ResearchMethodGroupBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    methods: list[ResearchMethodBrief] = []
    created_at: datetime
    deleted_at: datetime | None = None


class ResearchMethodResponse(ResearchMethodBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    groups: list[dict[str, Any]] = []
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    @field_validator("groups", mode="before")
    @classmethod
    def convert_groups_to_dict(cls, value: Any) -> list[dict[str, Any]]:
        if not value:
            return []
        if isinstance(value, list):
            result = []
            for item in value:
                if isinstance(item, dict):
                    result.append(item)
                else:
                    result.append(
                        {
                            "id": item.id,
                            "name": item.name,
                            "deleted_at": item.deleted_at,
                        }
                    )
            return result
        return []


class ResearchMethodSortOrderUpdate(BaseModel):
    sort_order: int = Field(..., description="Новый порядок сортировки")


class SortOrderBatchUpdateItem(BaseModel):
    id: int = Field(..., description="ID элемента")
    type: str = Field(..., description="Тип элемента: 'method' или 'group'")
    sort_order: int = Field(..., description="Новый порядок сортировки")


class SortOrderBatchUpdate(BaseModel):
    items: list[SortOrderBatchUpdateItem] = Field(
        ..., min_length=1, description="Список элементов для обновления"
    )


class AvailableResearchMethodBrief(BaseModel):
    """Краткое описание метода внутри группы для селекта."""

    id: int = Field(..., description="ID метода исследования")
    name: str = Field(..., description="Наименование метода исследования")
    sort_order: int = Field(..., description="Порядок сортировки")
    input_data: dict[str, Any] = Field(..., description="Структура входных данных")
    intermediate_data: dict[str, Any] = Field(
        ..., description="Структура промежуточных данных"
    )
    unit: str = Field(..., description="Единица измерения результата")
    equipment_data_default: list[int] | None = Field(
        None, description="Приборы по умолчанию"
    )


class AvailableResearchMethodEntry(BaseModel):
    """Элемент списка доступных методов: группа или отдельный метод."""

    id: int | str = Field(..., description="ID метода или группы (group_{id})")
    name: str = Field(..., description="Наименование метода или группы")
    sort_order: int = Field(..., description="Порядок сортировки")
    is_group: bool = Field(..., description="Является ли элемент группой методов")
    group_id: int | None = Field(None, description="ID группы методов")
    methods: list[AvailableResearchMethodBrief] | None = Field(
        None, description="Методы внутри группы"
    )
    input_data: dict[str, Any] | None = Field(
        None, description="Структура входных данных для отдельного метода"
    )
    intermediate_data: dict[str, Any] | None = Field(
        None, description="Структура промежуточных данных для отдельного метода"
    )
    unit: str | None = Field(None, description="Единица измерения результата")
    equipment_data_default: list[int] | None = Field(
        None, description="Приборы по умолчанию"
    )


class AvailableResearchMethodsResponse(BaseModel):
    """Ответ со списком доступных методов исследования для селекта."""

    methods: list[AvailableResearchMethodEntry] = Field(
        ..., description="Доступные методы и группы методов"
    )
