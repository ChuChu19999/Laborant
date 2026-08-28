from __future__ import annotations
from datetime import datetime
from typing import Annotated, Any
from pydantic import BaseModel, ConfigDict, Field, computed_field
from schemas.common import NonEmptyStr, OptionalNonEmptyStr, related_entity_name

DepartmentName = Annotated[NonEmptyStr, Field(max_length=100)]
DepartmentLocation = Annotated[NonEmptyStr, Field(max_length=255)]


class DepartmentBase(BaseModel):
    """Общие поля подразделения лаборатории."""

    name: DepartmentName = Field(..., description="Название подразделения")
    laboratory_location: DepartmentLocation = Field(..., description="Место осуществления лабораторной деятельности")


class DepartmentCreate(DepartmentBase):
    """Запрос на создание подразделения."""

    laboratory_id: int = Field(..., description="ID лаборатории")


class DepartmentUpdate(BaseModel):
    """Частичное обновление подразделения."""

    name: OptionalNonEmptyStr = Field(None, max_length=100)
    laboratory_location: OptionalNonEmptyStr = Field(None, max_length=255)


class DepartmentResponse(DepartmentBase):
    """Ответ API с данными подразделения."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    laboratory_id: int
    laboratory: Any = Field(default=None, exclude=True)
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    @computed_field
    @property
    def laboratory_name(self) -> str | None:
        return related_entity_name(self.laboratory)
