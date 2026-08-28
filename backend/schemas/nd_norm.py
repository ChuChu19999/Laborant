from __future__ import annotations
from datetime import datetime
from typing import Annotated, Any
from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator
from schemas.common import NonEmptyStr, OptionalNonEmptyStr, related_entity_name


class NdNormMethodDataItem(BaseModel):
    """Значение нормы для одного метода исследования."""

    method_id: Annotated[int, Field(gt=0, description="ID метода исследования")]
    value: str = Field(default="", description="Значение нормы для метода")

    @model_validator(mode="before")
    @classmethod
    def migrate_legacy_text_key(cls, data: Any) -> Any:
        if isinstance(data, dict) and "value" not in data and "text" in data:
            return {**data, "value": data["text"]}
        return data

    @field_validator("value", mode="before")
    @classmethod
    def normalize_value(cls, value: str | None) -> str:
        if value is None:
            return ""
        return str(value).strip()


class NdNormBase(BaseModel):
    """Общие поля нормы НД."""

    name: Annotated[NonEmptyStr, Field(max_length=255)] = Field(..., description="Наименование нормы")
    test_object: Annotated[NonEmptyStr, Field(max_length=255)] = Field(..., description="Объект испытаний")
    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: int | None = Field(None, description="ID подразделения")
    method_data: list[NdNormMethodDataItem] = Field(
        default_factory=list,
        description="Значения нормы по методам исследования",
    )


class NdNormCreate(NdNormBase):
    """Запрос на создание нормы НД."""


class NdNormUpdate(BaseModel):
    """Частичное обновление нормы НД."""

    name: OptionalNonEmptyStr = Field(None, max_length=255)
    test_object: OptionalNonEmptyStr = Field(None, max_length=255)
    laboratory_id: int | None = None
    department_id: int | None = None
    method_data: list[NdNormMethodDataItem] | None = None


class NdNormResponse(NdNormBase):
    """Ответ API с данными нормы НД."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    laboratory: Any = Field(default=None, exclude=True)
    department: Any = Field(default=None, exclude=True)
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    @computed_field
    @property
    def laboratory_name(self) -> str | None:
        return related_entity_name(self.laboratory)

    @computed_field
    @property
    def department_name(self) -> str | None:
        return related_entity_name(self.department)
