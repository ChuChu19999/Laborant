from __future__ import annotations
from datetime import datetime
from typing import Annotated, Any
from pydantic import BaseModel, ConfigDict, Field, computed_field
from schemas.common import NonEmptyStr, OptionalNonEmptyStr, related_entity_name

WellModeName = Annotated[NonEmptyStr, Field(max_length=255)]


class WellModeBase(BaseModel):
    """Общие поля режима скважины."""

    name: WellModeName = Field(..., description="Название режима скважины")


class WellModeCreate(WellModeBase):
    """Запрос на создание режима скважины."""

    branch_id: int = Field(..., description="ID филиала")


class WellModeUpdate(BaseModel):
    """Частичное обновление режима скважины."""

    name: OptionalNonEmptyStr = Field(None, max_length=255)


class WellModeResponse(WellModeBase):
    """Ответ API с данными режима скважины."""

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
