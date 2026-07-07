from __future__ import annotations
from datetime import date, datetime
from typing import Annotated
from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator
from models.equipment import EquipmentType
from schemas.common import (
    MethodDataDefault,
    NonEmptyStr,
    OptionalNonEmptyStr,
    PositiveIntList,
    make_enum_validator,
)

_validate_equipment_type = make_enum_validator(EquipmentType, "Тип прибора")
EquipmentTypeField = Annotated[str, AfterValidator(_validate_equipment_type)]
EquipmentName = Annotated[NonEmptyStr, Field(max_length=255)]
EquipmentSerialNumber = Annotated[NonEmptyStr, Field(max_length=100)]


class EquipmentBase(BaseModel):
    type: EquipmentTypeField = Field(..., description="Тип прибора или оборудования")
    name: EquipmentName = Field(
        ..., description="Наименование прибора или оборудования"
    )
    serial_number: EquipmentSerialNumber = Field(
        ..., description="Заводской номер прибора или оборудования"
    )
    verification_info: str = Field(
        ..., max_length=255, description="Сведения о результатах поверки"
    )
    verification_date: date = Field(..., description="Дата поверки")
    verification_end_date: date = Field(
        ..., description="Дата окончания срока действия поверки"
    )
    version: str = Field(..., max_length=8, description="Версия прибора (например, v1)")


class EquipmentCreate(BaseModel):
    type: EquipmentTypeField = Field(..., description="Тип прибора или оборудования")
    name: EquipmentName = Field(
        ..., description="Наименование прибора или оборудования"
    )
    serial_number: EquipmentSerialNumber = Field(
        ..., description="Заводской номер прибора или оборудования"
    )
    verification_info: str = Field(
        ..., max_length=255, description="Сведения о результатах поверки"
    )
    verification_date: date = Field(..., description="Дата поверки")
    verification_end_date: date = Field(
        ..., description="Дата окончания срока действия поверки"
    )
    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: int | None = Field(None, description="ID подразделения")
    method_data_default: MethodDataDefault = Field(
        default_factory=list,
        description="Методы по умолчанию",
    )


class EquipmentUpdate(BaseModel):
    type: EquipmentTypeField | None = None
    name: Annotated[OptionalNonEmptyStr, Field(max_length=255)] = None
    serial_number: Annotated[OptionalNonEmptyStr, Field(max_length=100)] = None
    verification_info: str | None = Field(None, max_length=255)
    verification_date: date | None = None
    verification_end_date: date | None = None
    version: str | None = Field(None, max_length=8)
    laboratory_id: int | None = None
    department_id: int | None = None
    method_data_default: PositiveIntList | None = None

    @field_validator("method_data_default", mode="before")
    @classmethod
    def validate_method_data_default(cls, value: list[int] | None) -> list[int] | None:
        if value is None:
            return None
        for item in value:
            if item <= 0:
                raise ValueError(
                    "Каждый ID метода должен быть положительным целым числом"
                )
        return value


class EquipmentResponse(EquipmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    laboratory_id: int
    department_id: int | None = None
    method_data_default: list[int] | None = None
    laboratory_name: str | None = None
    department_name: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
