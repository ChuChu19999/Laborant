from __future__ import annotations
from datetime import datetime
from typing import Annotated, Any
from pydantic import BaseModel, ConfigDict, Field, computed_field
from schemas.common import NonEmptyStr, OptionalNonEmptyStr, related_entity_name

SampleTypeName = Annotated[NonEmptyStr, Field(max_length=255)]


class SampleTypeBase(BaseModel):
    """Общие поля типа пробы."""

    name: SampleTypeName = Field(..., description="Название типа пробы")
    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: int | None = Field(None, description="ID подразделения")


class SampleTypeCreate(SampleTypeBase):
    """Запрос на создание типа пробы."""


class SampleTypeUpdate(BaseModel):
    """Частичное обновление типа пробы."""

    name: OptionalNonEmptyStr = Field(None, max_length=255)
    laboratory_id: int | None = None
    department_id: int | None = None


class SampleTypeResponse(SampleTypeBase):
    """Ответ API с данными типа пробы."""

    model_config = ConfigDict(from_attributes=True)

    id: int
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
