from __future__ import annotations
from typing import TypedDict
from pydantic import BaseModel, Field
from schemas.common import PositiveIntList


class ScopeIdFilter(TypedDict):
    """Фильтр списков по id лабораторий и подразделений."""

    laboratory_ids: list[int]
    department_ids: list[int]


class VisibilityScopeEntity(BaseModel):
    """Лаборатория или подразделение в области видимости (id и название)."""

    id: int
    name: str


class VisibilityScope(BaseModel):
    """Область видимости объекта по лабораториям и подразделениям."""

    laboratory_ids: PositiveIntList = Field(
        default_factory=list,
        description="ID лабораторий, для которых доступен объект",
    )
    department_ids: PositiveIntList = Field(
        default_factory=list,
        description="ID подразделений, для которых доступен объект",
    )
    laboratories: list[VisibilityScopeEntity] = Field(
        default_factory=list,
        description="Названия лабораторий для отображения",
    )
    departments: list[VisibilityScopeEntity] = Field(
        default_factory=list,
        description="Названия подразделений для отображения",
    )


__all__ = [
    "ScopeIdFilter",
    "VisibilityScope",
    "VisibilityScopeEntity",
]
