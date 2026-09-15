from __future__ import annotations
from datetime import datetime
from typing import Annotated, Any
from pydantic import BaseModel, ConfigDict, Field, computed_field
from schemas.common import NonEmptyStr, OptionalNonEmptyStr, related_entity_name

TestPurposeName = Annotated[NonEmptyStr, Field(max_length=255)]


class TestPurposeBase(BaseModel):
    """Общие поля цели испытаний."""

    name: TestPurposeName = Field(..., description="Название цели испытаний")
    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: int | None = Field(None, description="ID подразделения")


class TestPurposeCreate(TestPurposeBase):
    """Запрос на создание цели испытаний."""


class TestPurposeUpdate(BaseModel):
    """Частичное обновление цели испытаний."""

    name: OptionalNonEmptyStr = Field(None, max_length=255)
    laboratory_id: int | None = None
    department_id: int | None = None


class TestPurposeResponse(TestPurposeBase):
    """Ответ API с данными цели испытаний."""

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
