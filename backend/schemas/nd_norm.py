from __future__ import annotations
from datetime import datetime
from typing import Annotated, Any
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from schemas.common import NonEmptyStr, OptionalNonEmptyStr


class NdNormMethodDataItem(BaseModel):
    method_id: int = Field(..., description="ID метода исследования")
    value: str = Field(default="", description="Значение нормы для метода")

    @model_validator(mode="before")
    @classmethod
    def migrate_legacy_text_key(cls, data: Any) -> Any:
        if isinstance(data, dict) and "value" not in data and "text" in data:
            return {**data, "value": data["text"]}
        return data

    @field_validator("method_id")
    @classmethod
    def validate_method_id(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("ID метода должен быть положительным числом")
        return value

    @field_validator("value", mode="before")
    @classmethod
    def normalize_value(cls, value: str | None) -> str:
        if value is None:
            return ""
        return str(value).strip()


class NdNormCreate(BaseModel):
    name: Annotated[NonEmptyStr, Field(max_length=255)] = Field(..., description="Наименование нормы")
    test_object: Annotated[NonEmptyStr, Field(max_length=255)] = Field(..., description="Объект испытаний")
    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: int | None = Field(None, description="ID подразделения")
    method_data: list[NdNormMethodDataItem] = Field(
        default_factory=list,
        description="Значения нормы по методам исследования",
    )


class NdNormUpdate(BaseModel):
    name: Annotated[OptionalNonEmptyStr, Field(max_length=255)] = None
    test_object: Annotated[OptionalNonEmptyStr, Field(max_length=255)] = None
    laboratory_id: int | None = None
    department_id: int | None = None
    method_data: list[NdNormMethodDataItem] | None = None


class NdNormResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    test_object: str
    laboratory_id: int
    department_id: int | None = None
    method_data: list[NdNormMethodDataItem] = Field(default_factory=list)
    laboratory_name: str | None = None
    department_name: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
