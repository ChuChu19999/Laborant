from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator

SAMPLE_TYPE_CHOICES = Literal[
    "Исследования - ОИС",
    "Исследования - прочие",
    "Паспортизация",
    "Внеплановые",
]


class SampleBase(BaseModel):
    registration_number: str = Field(
        ..., max_length=50, description="Регистрационный номер пробы"
    )
    sample_type: SAMPLE_TYPE_CHOICES = Field(..., description="Тип пробы")
    test_object: str = Field(..., max_length=255, description="Объект испытаний")
    sampling_date: Optional[date] = Field(None, description="Дата отбора пробы")
    receiving_date: Optional[date] = Field(
        None, description="Дата получения пробы в лабораторию"
    )
    branch_id: Optional[int] = Field(None, description="ID филиала")
    sampling_location_id: Optional[int] = Field(
        None, description="ID места отбора пробы"
    )
    well: Optional[str] = Field(None, max_length=255, description="Название скважины")
    mode: Optional[str] = Field(
        None, max_length=255, description="Режим работы скважины"
    )
    phone: Optional[str] = Field(
        None, max_length=50, description="Номер телефона филиала"
    )
    selection_conditions: Optional[Dict[str, Any]] = Field(
        None, description="JSON с условиями отбора и их значениями"
    )

    @field_validator("registration_number")
    @classmethod
    def strip_registration_number(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Регистрационный номер не может быть пустым")
        return v.strip()


class SampleCreate(SampleBase):
    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: Optional[int] = Field(None, description="ID подразделения")


class SampleUpdate(BaseModel):
    registration_number: Optional[str] = Field(None, max_length=50)
    sample_type: Optional[SAMPLE_TYPE_CHOICES] = None
    test_object: Optional[str] = Field(None, max_length=255)
    sampling_date: Optional[date] = None
    receiving_date: Optional[date] = None
    branch_id: Optional[int] = None
    sampling_location_id: Optional[int] = None
    well: Optional[str] = Field(None, max_length=255)
    mode: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    selection_conditions: Optional[Dict[str, Any]] = None
    laboratory_id: Optional[int] = None
    department_id: Optional[int] = None

    @field_validator("registration_number", mode="before")
    @classmethod
    def strip_registration_number(cls, v: Optional[str]) -> Optional[str]:
        if v:
            if not v.strip():
                raise ValueError("Регистрационный номер не может быть пустым")
            return v.strip()
        return v


class SampleResponse(SampleBase):
    id: int
    laboratory_id: int
    department_id: Optional[int] = None
    laboratory_name: Optional[str] = None
    department_name: Optional[str] = None
    branch_name: Optional[str] = None
    sampling_location_name: Optional[str] = None
    protocols: Optional[List[Dict[str, Any]]] = Field(
        None, description="Список протоколов, к которым привязана проба"
    )
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SelectionConditionsBase(BaseModel):
    conditions: List[Dict[str, str]] = Field(
        ..., description="JSON с условиями отбора и их единицами измерения"
    )

    @field_validator("conditions")
    @classmethod
    def validate_conditions(cls, v: List[Dict[str, str]]) -> List[Dict[str, str]]:
        if not isinstance(v, list):
            raise ValueError("Условия должны быть списком")
        for condition in v:
            if not isinstance(condition, dict):
                raise ValueError("Каждое условие должно быть объектом")
            if not all(key in condition for key in ["variable", "unit"]):
                raise ValueError(
                    "Каждое условие должно содержать поля 'variable' и 'unit'"
                )
            if len(condition.keys()) > 2:
                raise ValueError(
                    "Каждое условие должно содержать только поля 'variable' и 'unit'"
                )
        return v


class SelectionConditionsCreate(SelectionConditionsBase):
    laboratory_id: Optional[int] = Field(None, description="ID лаборатории")
    department_id: Optional[int] = Field(None, description="ID подразделения")


class SelectionConditionsUpdate(BaseModel):
    conditions: Optional[List[Dict[str, str]]] = None
    laboratory_id: Optional[int] = None
    department_id: Optional[int] = None


class SelectionConditionsResponse(SelectionConditionsBase):
    id: int
    laboratory_id: Optional[int] = None
    department_id: Optional[int] = None
    laboratory_name: Optional[str] = None
    department_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MassFractionOilRefractionTableBase(BaseModel):
    c_value: str = Field(..., description="Массовая доля нефти (C) в процентах")
    n_value: str = Field(..., description="Показатель преломления (n)")

    @field_validator("c_value")
    @classmethod
    def validate_c_value(cls, v: str) -> str:
        try:
            c_float = float(v)
            if c_float < 0 or c_float > 100:
                raise ValueError(
                    "Массовая доля нефти должна быть в диапазоне от 0 до 100"
                )
        except ValueError:
            raise ValueError("Массовая доля нефти должна быть числом")
        return v


class MassFractionOilRefractionTableCreate(MassFractionOilRefractionTableBase):
    research_method_id: int = Field(..., description="ID метода исследования")


class MassFractionOilRefractionTableUpdate(BaseModel):
    c_value: Optional[str] = None
    n_value: Optional[str] = None

    @field_validator("c_value", mode="before")
    @classmethod
    def validate_c_value(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            try:
                c_float = float(v)
                if c_float < 0 or c_float > 100:
                    raise ValueError(
                        "Массовая доля нефти должна быть в диапазоне от 0 до 100"
                    )
            except ValueError:
                raise ValueError("Массовая доля нефти должна быть числом")
        return v


class MassFractionOilRefractionTableResponse(MassFractionOilRefractionTableBase):
    id: int
    research_method_id: int
    research_method_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True
