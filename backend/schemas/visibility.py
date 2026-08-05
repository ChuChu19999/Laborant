from __future__ import annotations
from typing import Any
from pydantic import BaseModel, Field
from schemas.common import PositiveIntList


class VisibilityScopeEntity(BaseModel):
    id: int
    name: str


class VisibilityScope(BaseModel):
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


def visibility_scope_to_dict(scope: VisibilityScope) -> dict[str, Any]:
    """Сериализовать область видимости для сохранения в JSON."""
    return {
        "laboratory_ids": scope.laboratory_ids,
        "department_ids": scope.department_ids,
    }
