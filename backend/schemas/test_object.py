from __future__ import annotations
from datetime import datetime
from typing import Annotated
from pydantic import BaseModel, ConfigDict, Field
from schemas.common import NonEmptyStr, OptionalNonEmptyStr, OptionalProtocolAbbreviation
from schemas.visibility import VisibilityScope


class TestObjectBase(BaseModel):
    """Общие поля объекта испытаний."""

    name: Annotated[NonEmptyStr, Field(max_length=255)] = Field(..., description="Наименование объекта испытаний")
    tag: Annotated[NonEmptyStr, Field(max_length=50)] = Field(..., description="Тег для методов исследования")
    protocol_abbreviation: OptionalProtocolAbbreviation = Field(
        default=None,
        description="Аббревиатура для номера протокола",
    )
    visibility_scope: VisibilityScope = Field(
        default_factory=VisibilityScope,
        description="Область видимости по лабораториям и подразделениям",
    )


class TestObjectCreate(TestObjectBase):
    """Запрос на создание объекта испытаний."""


class TestObjectUpdate(BaseModel):
    """Частичное обновление объекта испытаний."""

    name: OptionalNonEmptyStr = Field(None, max_length=255)
    tag: OptionalNonEmptyStr = Field(None, max_length=50)
    protocol_abbreviation: OptionalProtocolAbbreviation = None
    visibility_scope: VisibilityScope | None = None


class TestObjectResponse(TestObjectBase):
    """Ответ API с данными объекта испытаний."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class TestObjectSelectItem(BaseModel):
    """Краткие данные объекта испытаний для селекта."""

    name: str
    tag: str
