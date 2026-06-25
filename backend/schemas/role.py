from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from models.role import RoleType
from schemas.test_object import VisibilityScope, visibility_scope_to_dict


class RoleBase(BaseModel):
    name: str = Field(..., max_length=255, description="Наименование роли")
    role_type: str = Field(..., description="Тип роли: laborant, engineer")
    visibility_scope: VisibilityScope = Field(
        default_factory=VisibilityScope,
        description="Область видимости по лабораториям и подразделениям",
    )

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Наименование роли не может быть пустым")
        return value.strip()

    @field_validator("role_type")
    @classmethod
    def validate_role_type(cls, value: str) -> str:
        valid_types = [item.value for item in RoleType]
        if value not in valid_types:
            raise ValueError(f"Тип роли должен быть одним из: {', '.join(valid_types)}")
        return value


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    role_type: Optional[str] = None
    visibility_scope: Optional[VisibilityScope] = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: Optional[str]) -> Optional[str]:
        if value is not None:
            if not str(value).strip():
                raise ValueError("Наименование роли не может быть пустым")
            return str(value).strip()
        return value

    @field_validator("role_type")
    @classmethod
    def validate_role_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        valid_types = [item.value for item in RoleType]
        if value not in valid_types:
            raise ValueError(f"Тип роли должен быть одним из: {', '.join(valid_types)}")
        return value


class RoleResponse(RoleBase):
    id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


__all__ = [
    "RoleBase",
    "RoleCreate",
    "RoleUpdate",
    "RoleResponse",
    "visibility_scope_to_dict",
]
