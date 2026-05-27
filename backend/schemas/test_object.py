from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class VisibilityScopeEntity(BaseModel):
    id: int
    name: str


class VisibilityScope(BaseModel):
    laboratory_ids: List[int] = Field(
        default_factory=list,
        description="ID лабораторий, для которых доступен объект",
    )
    department_ids: List[int] = Field(
        default_factory=list,
        description="ID подразделений, для которых доступен объект",
    )
    laboratories: List[VisibilityScopeEntity] = Field(
        default_factory=list,
        description="Названия лабораторий для отображения",
    )
    departments: List[VisibilityScopeEntity] = Field(
        default_factory=list,
        description="Названия подразделений для отображения",
    )

    @field_validator("laboratory_ids", "department_ids")
    @classmethod
    def validate_ids(cls, value: List[int]) -> List[int]:
        for item in value:
            if not isinstance(item, int) or item <= 0:
                raise ValueError("Каждый ID должен быть положительным целым числом")
        return value


class TestObjectBase(BaseModel):
    name: str = Field(..., max_length=255, description="Наименование объекта испытаний")
    tag: str = Field(..., max_length=50, description="Тег для методов исследования")
    visibility_scope: VisibilityScope = Field(
        default_factory=VisibilityScope,
        description="Область видимости по лабораториям и подразделениям",
    )

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Наименование не может быть пустым")
        return value.strip()

    @field_validator("tag")
    @classmethod
    def validate_tag(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Тег не может быть пустым")
        return value.strip()


class TestObjectCreate(TestObjectBase):
    pass


class TestObjectUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    tag: Optional[str] = Field(None, max_length=50)
    visibility_scope: Optional[VisibilityScope] = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: Optional[str]) -> Optional[str]:
        if value is not None:
            if not str(value).strip():
                raise ValueError("Наименование не может быть пустым")
            return str(value).strip()
        return value

    @field_validator("tag", mode="before")
    @classmethod
    def validate_tag(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not str(value).strip():
            raise ValueError("Тег не может быть пустым")
        return str(value).strip()


class TestObjectResponse(TestObjectBase):
    id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TestObjectSelectItem(BaseModel):
    name: str
    tag: str


def visibility_scope_to_dict(scope: VisibilityScope) -> Dict[str, Any]:
    """Сериализовать область видимости для сохранения в JSON."""
    return {
        "laboratory_ids": scope.laboratory_ids,
        "department_ids": scope.department_ids,
    }
