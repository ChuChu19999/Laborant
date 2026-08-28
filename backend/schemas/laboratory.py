from __future__ import annotations
from datetime import datetime
from typing import Annotated, Any
from pydantic import BaseModel, ConfigDict, Field, computed_field
from schemas.common import NonEmptyStr, OptionalNonEmptyStr, active_related_count

LaboratoryName = Annotated[NonEmptyStr, Field(max_length=100)]
LaboratoryFullName = Annotated[NonEmptyStr, Field(max_length=255)]


class LaboratoryBase(BaseModel):
    """Общие поля лаборатории."""

    name: LaboratoryName = Field(..., description="Аббревиатура")
    full_name: LaboratoryFullName = Field(..., description="Полное название")
    laboratory_location: OptionalNonEmptyStr = Field(
        None,
        max_length=255,
        description="Место осуществления лабораторной деятельности",
    )


class LaboratoryCreate(LaboratoryBase):
    """Запрос на создание лаборатории."""


class LaboratoryUpdate(BaseModel):
    """Частичное обновление лаборатории."""

    name: OptionalNonEmptyStr = Field(None, max_length=100)
    full_name: OptionalNonEmptyStr = Field(None, max_length=255)
    laboratory_location: OptionalNonEmptyStr = Field(None, max_length=255)


class LaboratoryResponse(LaboratoryBase):
    """Ответ API с данными лаборатории."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    departments: Any = Field(default=None, exclude=True)
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    @computed_field
    @property
    def departments_count(self) -> int:
        return active_related_count(self.departments)
