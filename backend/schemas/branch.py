from __future__ import annotations
from datetime import datetime
from typing import Annotated
from pydantic import BaseModel, ConfigDict, Field
from schemas.common import NonEmptyStr, OptionalNonEmptyStr

BranchName = Annotated[NonEmptyStr, Field(max_length=255)]


class BranchBase(BaseModel):
    """Общие поля филиала."""

    name: BranchName = Field(..., description="Название филиала")
    phone: OptionalNonEmptyStr = Field(None, max_length=20, description="Номер телефона филиала")


class BranchCreate(BranchBase):
    """Запрос на создание филиала."""

    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: int | None = Field(None, description="ID подразделения")


class BranchUpdate(BaseModel):
    """Частичное обновление филиала."""

    name: OptionalNonEmptyStr = Field(None, max_length=255)
    phone: OptionalNonEmptyStr = Field(None, max_length=20)


class BranchResponse(BranchBase):
    """Ответ API с данными филиала."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    laboratory_id: int
    department_id: int | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
