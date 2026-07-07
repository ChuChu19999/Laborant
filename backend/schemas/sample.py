from __future__ import annotations
from datetime import date, datetime
from typing import Annotated, Any, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator
from schemas.common import (
    NonEmptyStr,
    OilMassFractionCValue,
    OptionalNonEmptyStr,
    OptionalOilMassFractionCValue,
    validate_oil_mass_fraction_c_value,
)

SAMPLE_TYPE_CHOICES = Literal[
    "Исследования - ОИС",
    "Исследования - прочие",
    "Паспортизация",
    "Внеплановые",
]


class SampleBase(BaseModel):
    registration_number: Annotated[NonEmptyStr, Field(max_length=50)] = Field(
        ..., description="Регистрационный номер пробы"
    )
    sample_type: SAMPLE_TYPE_CHOICES = Field(..., description="Тип пробы")
    test_object: str = Field(..., max_length=255, description="Объект испытаний")
    sampling_date: date | None = Field(None, description="Дата отбора пробы")
    receiving_date: date | None = Field(
        None, description="Дата получения пробы в лабораторию"
    )
    branch_id: int | None = Field(None, description="ID филиала")
    sampling_location_id: int | None = Field(None, description="ID места отбора пробы")
    well: str | None = Field(None, max_length=255, description="Название скважины")
    mode: str | None = Field(None, max_length=255, description="Режим работы скважины")
    indicators_count: int = Field(..., ge=0, description="Количество показателей")
    phone: str | None = Field(None, max_length=50, description="Номер телефона филиала")
    selection_conditions: dict[str, Any] | None = Field(
        None, description="JSON с условиями отбора и их значениями"
    )
    added_by: str | None = Field(
        None, max_length=150, description="hsnils лица, добавившего пробу"
    )


class SampleCreate(SampleBase):
    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: int | None = Field(None, description="ID подразделения")


class SampleUpdate(BaseModel):
    registration_number: Annotated[OptionalNonEmptyStr, Field(max_length=50)] = None
    sample_type: SAMPLE_TYPE_CHOICES | None = None
    test_object: str | None = Field(None, max_length=255)
    sampling_date: date | None = None
    receiving_date: date | None = None
    branch_id: int | None = None
    sampling_location_id: int | None = None
    well: str | None = Field(None, max_length=255)
    mode: str | None = Field(None, max_length=255)
    indicators_count: int | None = Field(
        None, ge=0, description="Количество показателей"
    )
    phone: str | None = Field(None, max_length=50)
    selection_conditions: dict[str, Any] | None = None
    added_by: str | None = Field(None, max_length=150)
    laboratory_id: int | None = None
    department_id: int | None = None


class SampleResponse(SampleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    laboratory_id: int
    department_id: int | None = None
    laboratory_name: str | None = None
    department_name: str | None = None
    branch_name: str | None = None
    sampling_location_name: str | None = None
    protocols: list[dict[str, Any]] | None = Field(
        None, description="Список протоколов, к которым привязана проба"
    )
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class SelectionConditionsBase(BaseModel):
    conditions: list[dict[str, str]] = Field(
        ..., description="JSON с условиями отбора и их единицами измерения"
    )

    @field_validator("conditions")
    @classmethod
    def validate_conditions(cls, value: list[dict[str, str]]) -> list[dict[str, str]]:
        for condition in value:
            if not all(key in condition for key in ["variable", "unit"]):
                raise ValueError(
                    "Каждое условие должно содержать поля 'variable' и 'unit'"
                )
            if len(condition.keys()) > 2:
                raise ValueError(
                    "Каждое условие должно содержать только поля 'variable' и 'unit'"
                )
        return value


class SelectionConditionsCreate(SelectionConditionsBase):
    laboratory_id: int | None = Field(None, description="ID лаборатории")
    department_id: int | None = Field(None, description="ID подразделения")


class SelectionConditionsUpdate(BaseModel):
    conditions: list[dict[str, str]] | None = None
    laboratory_id: int | None = None
    department_id: int | None = None


class SelectionConditionsResponse(SelectionConditionsBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    laboratory_id: int | None = None
    department_id: int | None = None
    laboratory_name: str | None = None
    department_name: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class MassFractionOilRefractionTableBase(BaseModel):
    c_value: OilMassFractionCValue = Field(
        ..., description="Массовая доля нефти (C) в процентах"
    )
    n_value: str = Field(..., description="Показатель преломления (n)")


class MassFractionOilRefractionTableCreate(MassFractionOilRefractionTableBase):
    research_method_id: int = Field(..., description="ID метода исследования")


class MassFractionOilRefractionTableUpdate(BaseModel):
    c_value: OptionalOilMassFractionCValue = None
    n_value: str | None = None


class MassFractionOilRefractionTableResponse(MassFractionOilRefractionTableBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    research_method_id: int
    research_method_name: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class MassFractionOilRefractionTableBulkUpdate(BaseModel):
    research_method_id: int = Field(..., description="ID метода исследования")
    entries: list[dict[str, Any]] = Field(
        ...,
        description="Список точек градуировочного графика с полями c_value и n_value",
    )

    @field_validator("entries")
    @classmethod
    def validate_entries(cls, value: list[dict[str, Any]]) -> list[dict[str, Any]]:
        for entry in value:
            if "c_value" not in entry or "n_value" not in entry:
                raise ValueError("Каждая запись должна содержать c_value и n_value")
            validate_oil_mass_fraction_c_value(str(entry["c_value"]))
        return value
