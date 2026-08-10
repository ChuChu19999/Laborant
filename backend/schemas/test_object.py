from __future__ import annotations
from datetime import datetime
from typing import Annotated, Any
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field
from schemas.common import NonEmptyStr, OptionalNonEmptyStr
from schemas.visibility import VisibilityScope


def _optional_protocol_abbreviation(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if len(text) > 8:
        raise ValueError("Аббревиатура для протокола не должна превышать 8 символов")
    return text


OptionalProtocolAbbreviation = Annotated[str | None, BeforeValidator(_optional_protocol_abbreviation)]


class TestObjectBase(BaseModel):
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
    pass


class TestObjectUpdate(BaseModel):
    name: Annotated[OptionalNonEmptyStr, Field(max_length=255)] = None
    tag: Annotated[OptionalNonEmptyStr, Field(max_length=50)] = None
    protocol_abbreviation: OptionalProtocolAbbreviation = None
    visibility_scope: VisibilityScope | None = None


class TestObjectResponse(TestObjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class TestObjectSelectItem(BaseModel):
    name: str
    tag: str
