from __future__ import annotations
from datetime import datetime
from typing import Annotated, Any
from pydantic import BaseModel, ConfigDict, Field, computed_field
from schemas.common import NonEmptyStr, OptionalNonEmptyStr, related_entity_name, related_entity_phone

SamplingLocationName = Annotated[NonEmptyStr, Field(max_length=255)]


class SamplingLocationBase(BaseModel):
    """Общие поля места отбора пробы."""

    name: SamplingLocationName = Field(..., description="Название места отбора пробы")


class SamplingLocationCreate(SamplingLocationBase):
    """Запрос на создание места отбора пробы."""

    branch_id: int = Field(..., description="ID филиала")


class SamplingLocationUpdate(BaseModel):
    """Частичное обновление места отбора пробы."""

    name: OptionalNonEmptyStr = Field(None, max_length=255)


class SamplingLocationResponse(SamplingLocationBase):
    """Ответ API с данными места отбора пробы."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    branch_id: int
    branch: Any = Field(default=None, exclude=True)
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    @computed_field
    @property
    def branch_name(self) -> str | None:
        return related_entity_name(self.branch)

    @computed_field
    @property
    def branch_phone(self) -> str | None:
        return related_entity_phone(self.branch)
