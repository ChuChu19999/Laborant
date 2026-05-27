from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator
from models.research import RoundingType


class ResearchMethodBase(BaseModel):
    name: str = Field(
        ..., max_length=255, description="Наименование метода исследования"
    )
    sample_type: List[str] = Field(..., description="Типы исследуемых проб")
    formula: str = Field(..., max_length=255, description="Формула для расчета")
    measurement_error: Dict[str, Any] = Field(..., description="Погрешность измерения")
    unit: str = Field(..., max_length=20, description="Единица измерения результата")
    measurement_method: str = Field(..., max_length=255, description="Метод измерения")
    nd_code: str = Field(..., max_length=255, description="Шифр НД")
    nd_name: str = Field(..., max_length=255, description="Наименование НД")
    input_data: Dict[str, Any] = Field(..., description="Структура входных данных")
    intermediate_data: Dict[str, Any] = Field(
        ..., description="Структура промежуточных данных"
    )
    convergence_conditions: Dict[str, Any] = Field(
        default_factory=lambda: {
            "formulas": [{"formula": "", "convergence_value": "satisfactory"}]
        },
        description="Условия повторяемости",
    )
    rounding_type: str = Field(..., description="Тип округления")
    rounding_decimal: int = Field(..., ge=0, description="Количество знаков округления")
    is_group_member: bool = Field(default=False, description="Является частью группы")
    equipment_data_default: Optional[List[int]] = Field(
        None, description="Приборы по умолчанию"
    )
    sort_order: Optional[int] = Field(None, description="Порядок сортировки")
    laboratory_id: Optional[int] = Field(None, description="ID лаборатории")
    department_id: Optional[int] = Field(None, description="ID подразделения")

    @field_validator("rounding_type")
    @classmethod
    def validate_rounding_type(cls, v: str) -> str:
        valid_types = [e.value for e in RoundingType]
        if v not in valid_types:
            raise ValueError(
                f"Неверный тип округления. Допустимые значения: {', '.join(valid_types)}"
            )
        return v

    @field_validator("equipment_data_default")
    @classmethod
    def validate_equipment_data_default(
        cls, v: Optional[List[int]]
    ) -> Optional[List[int]]:
        if v is None:
            return []
        if not isinstance(v, list):
            raise ValueError("Приборы по умолчанию должны быть списком")
        for item in v:
            if not isinstance(item, int) or item <= 0:
                raise ValueError(
                    "Каждый ID прибора должен быть положительным целым числом"
                )
        return v

    @field_validator("measurement_error")
    @classmethod
    def validate_measurement_error(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(v, dict):
            raise ValueError("Погрешность должна быть объектом")
        if not v:
            return {"type": "fixed", "value": "0"}
        if "type" not in v:
            raise ValueError("Не указан тип погрешности")
        if v["type"] not in ["fixed", "formula"]:
            raise ValueError("Неверный тип погрешности")
        if "value" not in v:
            raise ValueError("Не указано значение погрешности")
        if v["type"] == "fixed":
            try:
                float(v["value"])
            except (ValueError, TypeError):
                raise ValueError("Фиксированное значение должно быть числом")
        return v

    @field_validator("input_data")
    @classmethod
    def validate_input_data(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(v, dict):
            raise ValueError("Входные данные должны быть словарем")
        required_keys = {"fields"}
        if not all(key in v for key in required_keys):
            raise ValueError(
                f"Входные данные должны содержать следующие ключи: {required_keys}"
            )
        for field in v.get("fields", []):
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
        return v

    @field_validator("intermediate_data")
    @classmethod
    def validate_intermediate_data(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(v, dict):
            raise ValueError("Промежуточные данные должны быть словарем")
        for field in v.get("fields", []):
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
        return v

    @field_validator("convergence_conditions", mode="before")
    @classmethod
    def normalize_convergence_conditions(cls, v: Any) -> Dict[str, Any]:
        """Нормализует convergence_conditions, разрешая пустые значения для фракционного состава."""
        # Если это список (пустой или нет), преобразуем в пустой словарь
        if isinstance(v, list):
            return {}
        # Если это None, возвращаем пустой словарь
        if v is None:
            return {}
        # Если это не словарь, возвращаем пустой словарь
        if not isinstance(v, dict):
            return {}
        # Если словарь пустой, разрешаем это (особенность фракционного состава)
        if not v:
            return {}
        # Если словарь не пустой, но не содержит "formulas", возвращаем как есть (пустой словарь)
        if "formulas" not in v:
            return {}
        return v

    @field_validator("convergence_conditions")
    @classmethod
    def validate_convergence_conditions(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        """Валидирует структуру convergence_conditions, разрешая пустые значения."""
        # Пустой словарь разрешен (особенность фракционного состава)
        if not v:
            return v

        # Если словарь не пустой, валидируем структуру
        if "formulas" not in v:
            raise ValueError("Условия повторяемости должны содержать ключ 'formulas'")
        if not isinstance(v["formulas"], list):
            raise ValueError("Формулы условий повторяемости должны быть списком")
        valid_convergence_values = [
            "satisfactory",
            "unsatisfactory",
            "absence",
            "traces",
            "custom",
        ]
        for formula_data in v["formulas"]:
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
        return v


class ResearchMethodCreate(ResearchMethodBase):
    pass


class ResearchMethodUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    sample_type: Optional[List[str]] = None
    formula: Optional[str] = Field(None, max_length=255)
    measurement_error: Optional[Dict[str, Any]] = None
    unit: Optional[str] = Field(None, max_length=20)
    measurement_method: Optional[str] = Field(None, max_length=255)
    nd_code: Optional[str] = Field(None, max_length=255)
    nd_name: Optional[str] = Field(None, max_length=255)
    input_data: Optional[Dict[str, Any]] = None
    intermediate_data: Optional[Dict[str, Any]] = None
    convergence_conditions: Optional[Dict[str, Any]] = None
    rounding_type: Optional[str] = None
    rounding_decimal: Optional[int] = Field(None, ge=0)
    is_group_member: Optional[bool] = None
    equipment_data_default: Optional[List[int]] = None
    sort_order: Optional[int] = None
    laboratory_id: Optional[int] = None
    department_id: Optional[int] = None


class ResearchMethodGroupBase(BaseModel):
    name: str = Field(
        ..., max_length=255, description="Наименование группы методов исследования"
    )
    sort_order: Optional[int] = Field(None, description="Порядок сортировки группы")

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        if v:
            v = v.strip()
            if not v:
                raise ValueError("Название группы не может быть пустым")
        return v


class ResearchMethodGroupCreate(ResearchMethodGroupBase):
    method_ids: List[int] = Field(
        ..., min_length=1, description="ID методов исследования"
    )

    @field_validator("method_ids")
    @classmethod
    def validate_method_ids(cls, v: List[int]) -> List[int]:
        if not v:
            raise ValueError("Необходимо выбрать хотя бы один метод")
        return v


class ResearchMethodGroupUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    method_ids: Optional[List[int]] = None
    sort_order: Optional[int] = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v: Optional[str]) -> Optional[str]:
        if v:
            v = v.strip()
            if not v:
                raise ValueError("Название группы не может быть пустым")
        return v


class ResearchMethodBrief(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class ResearchMethodGroupResponse(ResearchMethodGroupBase):
    id: int
    methods: List[ResearchMethodBrief] = []
    created_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ResearchMethodResponse(ResearchMethodBase):
    id: int
    groups: List[Dict[str, Any]] = []
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    @field_validator("groups", mode="before")
    @classmethod
    def convert_groups_to_dict(cls, v: Any) -> List[Dict[str, Any]]:
        if not v:
            return []
        if isinstance(v, list):
            result = []
            for item in v:
                if isinstance(item, dict):
                    result.append(item)
                else:
                    result.append({"id": item.id, "name": item.name})
            return result
        return []

    class Config:
        from_attributes = True


class ResearchMethodSortOrderUpdate(BaseModel):
    sort_order: int = Field(..., description="Новый порядок сортировки")


class SortOrderBatchUpdateItem(BaseModel):
    id: int = Field(..., description="ID элемента")
    type: str = Field(..., description="Тип элемента: 'method' или 'group'")
    sort_order: int = Field(..., description="Новый порядок сортировки")


class SortOrderBatchUpdate(BaseModel):
    items: List[SortOrderBatchUpdateItem] = Field(
        ..., min_length=1, description="Список элементов для обновления"
    )
