from __future__ import annotations
from datetime import date, datetime
from typing import Annotated, Any
from pydantic import AfterValidator, BaseModel, ConfigDict, Field, computed_field
from models.equipment import EquipmentType
from schemas.common import (
    MethodDataDefault,
    NonEmptyStr,
    OptionalNonEmptyStr,
    PositiveIntList,
    make_enum_validator,
    related_entity_name,
)

_validate_equipment_type = make_enum_validator(EquipmentType, "Тип прибора")
EquipmentTypeField = Annotated[str, AfterValidator(_validate_equipment_type)]
EquipmentName = Annotated[NonEmptyStr, Field(max_length=255)]
EquipmentSerialNumber = Annotated[NonEmptyStr, Field(max_length=100)]
EquipmentVerificationInfo = Annotated[NonEmptyStr, Field(max_length=255)]


class EquipmentFieldsBase(BaseModel):
    """Общие поля прибора или оборудования без версии."""

    type: EquipmentTypeField = Field(..., description="Тип прибора или оборудования")
    name: EquipmentName = Field(..., description="Наименование прибора или оборудования")
    serial_number: EquipmentSerialNumber = Field(..., description="Заводской номер прибора или оборудования")
    verification_info: EquipmentVerificationInfo = Field(..., description="Сведения о результатах поверки")
    verification_date: date = Field(..., description="Дата поверки")
    verification_end_date: date = Field(..., description="Дата окончания срока действия поверки")


class EquipmentBase(EquipmentFieldsBase):
    """Общие поля прибора или оборудования."""

    version: str = Field(..., max_length=8, description="Версия прибора (например, v1)")


class EquipmentCreate(EquipmentFieldsBase):
    """Запрос на создание прибора или оборудования."""

    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: int | None = Field(None, description="ID подразделения")
    method_data_default: MethodDataDefault = Field(
        default_factory=list,
        description="Методы по умолчанию",
    )


class EquipmentUpdate(BaseModel):
    """Частичное обновление прибора или оборудования."""

    type: EquipmentTypeField | None = None
    name: OptionalNonEmptyStr = Field(None, max_length=255)
    serial_number: OptionalNonEmptyStr = Field(None, max_length=100)
    verification_info: OptionalNonEmptyStr = Field(None, max_length=255)
    verification_date: date | None = None
    verification_end_date: date | None = None
    laboratory_id: int | None = None
    department_id: int | None = None
    method_data_default: PositiveIntList | None = None


class EquipmentResponse(EquipmentBase):
    """Ответ API с данными прибора или оборудования."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    laboratory_id: int
    department_id: int | None = None
    method_data_default: list[int] | None = None
    laboratory: Any = Field(default=None, exclude=True)
    department: Any = Field(default=None, exclude=True)
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    @computed_field
    @property
    def laboratory_name(self) -> str | None:
        return related_entity_name(self.laboratory)

    @computed_field
    @property
    def department_name(self) -> str | None:
        return related_entity_name(self.department)
