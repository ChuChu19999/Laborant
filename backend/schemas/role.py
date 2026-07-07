from __future__ import annotations
from datetime import datetime
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field
from schemas.common import NonEmptyStr, OptionalNonEmptyStr
from schemas.test_object import VisibilityScope, visibility_scope_to_dict

RoleTypeValue = Literal["laborant", "engineer"]


class RoleBase(BaseModel):
    name: Annotated[NonEmptyStr, Field(max_length=255)] = Field(
        ..., description="Наименование роли"
    )
    role_type: RoleTypeValue = Field(..., description="Тип роли: laborant, engineer")
    visibility_scope: VisibilityScope = Field(
        default_factory=VisibilityScope,
        description="Область видимости по лабораториям и подразделениям",
    )


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    name: Annotated[OptionalNonEmptyStr, Field(max_length=255)] = None
    role_type: RoleTypeValue | None = None
    visibility_scope: VisibilityScope | None = None


class RoleResponse(RoleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


__all__ = [
    "RoleBase",
    "RoleCreate",
    "RoleUpdate",
    "RoleResponse",
    "RoleTypeValue",
    "visibility_scope_to_dict",
]
