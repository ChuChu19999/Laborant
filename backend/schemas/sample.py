from __future__ import annotations
from datetime import date, datetime
from typing import Annotated, Any, Literal
from pydantic import BaseModel, ConfigDict, Field, computed_field
from schemas.common import NonEmptyStr, OptionalExecutorHsnils, OptionalNonEmptyStr, related_entity_name

SAMPLE_TYPE_CHOICES = Literal[
    "Исследования - ОИС",
    "Исследования - прочие",
    "Паспортизация",
    "Внеплановые",
]


class SampleProtocolSummary(BaseModel):
    """Краткие сведения о протоколе, привязанном к пробе."""

    id: int
    test_protocol_number: str | None = None
    test_protocol_date: date | None = None
    is_accredited: bool = False
    formatted_protocol_number: str | None = None


class SampleBase(BaseModel):
    """Общие поля пробы."""

    registration_number: Annotated[NonEmptyStr, Field(max_length=50)] = Field(
        ..., description="Регистрационный номер пробы"
    )
    sample_type: SAMPLE_TYPE_CHOICES | None = Field(None, description="Тип пробы")
    test_object: Annotated[NonEmptyStr, Field(max_length=255)] = Field(..., description="Объект испытаний")
    sampling_date: date | None = Field(None, description="Дата отбора пробы")
    receiving_date: date | None = Field(None, description="Дата получения пробы в лабораторию")
    branch_id: int | None = Field(None, description="ID филиала")
    sampling_location_id: int | None = Field(None, description="ID места отбора пробы")
    well: str | None = Field(None, max_length=255, description="Название скважины")
    mode: str | None = Field(None, max_length=255, description="Режим работы скважины")
    indicators_count: int = Field(..., ge=0, description="Количество показателей")
    phone: str | None = Field(None, max_length=50, description="Номер телефона филиала")
    selection_conditions: dict[str, Any] | None = Field(None, description="JSON с условиями отбора и их значениями")
    added_by: OptionalExecutorHsnils = Field(None, description="hsnils лица, добавившего пробу")


class SampleCreate(SampleBase):
    """Запрос на создание пробы."""

    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: int | None = Field(None, description="ID подразделения")


class SampleUpdate(BaseModel):
    """Частичное обновление пробы."""

    registration_number: OptionalNonEmptyStr = Field(None, max_length=50)
    sample_type: SAMPLE_TYPE_CHOICES | None = None
    test_object: OptionalNonEmptyStr = Field(None, max_length=255)
    sampling_date: date | None = None
    receiving_date: date | None = None
    branch_id: int | None = None
    sampling_location_id: int | None = None
    well: str | None = Field(None, max_length=255)
    mode: str | None = Field(None, max_length=255)
    indicators_count: int | None = Field(None, ge=0, description="Количество показателей")
    phone: str | None = Field(None, max_length=50)
    selection_conditions: dict[str, Any] | None = None
    added_by: OptionalExecutorHsnils = None
    laboratory_id: int | None = None
    department_id: int | None = None


class SampleResponse(SampleBase):
    """Ответ API с данными пробы."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    laboratory_id: int
    department_id: int | None = None
    laboratory: Any = Field(default=None, exclude=True)
    department: Any = Field(default=None, exclude=True)
    branch: Any = Field(default=None, exclude=True)
    sampling_location: Any = Field(default=None, exclude=True)
    protocols: list[SampleProtocolSummary] | None = Field(
        None, description="Список протоколов, к которым привязана проба"
    )
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

    @computed_field
    @property
    def branch_name(self) -> str | None:
        return related_entity_name(self.branch)

    @computed_field
    @property
    def sampling_location_name(self) -> str | None:
        return related_entity_name(self.sampling_location)


class RegistrationNumbersResponse(BaseModel):
    """Ответ API со списком проб по регистрационным номерам."""

    samples: list[SampleResponse]
