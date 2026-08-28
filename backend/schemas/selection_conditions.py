from __future__ import annotations
from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field, computed_field
from schemas.common import OptionalSelectionConditionsList, SelectionConditionsList, related_entity_name


class SelectionConditionsBase(BaseModel):
    """Общие поля набора условий отбора пробы."""

    conditions: SelectionConditionsList = Field(
        ...,
        description="JSON с условиями отбора и их единицами измерения",
    )


class SelectionConditionsCreate(SelectionConditionsBase):
    """Запрос на создание набора условий отбора."""

    laboratory_id: int | None = Field(None, description="ID лаборатории")
    department_id: int | None = Field(None, description="ID подразделения")


class SelectionConditionsUpdate(BaseModel):
    """Частичное обновление набора условий отбора."""

    conditions: OptionalSelectionConditionsList = None
    laboratory_id: int | None = None
    department_id: int | None = None


class SelectionConditionsResponse(SelectionConditionsBase):
    """Ответ API с набором условий отбора пробы."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    laboratory_id: int | None = None
    department_id: int | None = None
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
