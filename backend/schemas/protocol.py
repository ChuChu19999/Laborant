from __future__ import annotations
from datetime import date, datetime
from typing import Annotated, Any
from pydantic import BaseModel, ConfigDict, Field, computed_field
from schemas.common import NonEmptyStr, OptionalExecutorHsnils, OptionalNonEmptyStr, related_entity_name
from schemas.sample import SampleResponse

SamplingActNumber = Annotated[NonEmptyStr, Field(max_length=50)]


class ProtocolBase(BaseModel):
    """Общие поля протокола испытаний."""

    test_protocol_number: str | None = Field(None, max_length=100, description="Номер протокола испытаний")
    test_protocol_date: date | None = Field(None, description="Дата протокола испытаний")
    is_accredited: bool = Field(default=False, description="Признак аккредитации протокола")
    sampling_act_number: SamplingActNumber = Field(..., description="Номер акта отбора")
    issued: OptionalExecutorHsnils = Field(None, description="hsnils лица, оформившего протокол")
    approved: OptionalExecutorHsnils = Field(None, description="hsnils лица, утвердившего протокол")
    issued_position: str | None = Field(None, max_length=100, description="Должность оформившего")
    approved_position: str | None = Field(None, max_length=100, description="Должность утвердившего")
    samples: list[int] | None = Field(None, description="Массив ID проб, привязанных к протоколу")


class ProtocolCreate(ProtocolBase):
    """Запрос на создание протокола испытаний."""

    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: int | None = Field(None, description="ID подразделения")
    protocol_template_id: int | None = Field(None, description="ID шаблона протокола")


class ProtocolUpdate(BaseModel):
    """Частичное обновление протокола испытаний."""

    test_protocol_number: str | None = Field(None, max_length=100)
    test_protocol_date: date | None = None
    is_accredited: bool | None = None
    sampling_act_number: OptionalNonEmptyStr = Field(None, max_length=50)
    issued: OptionalExecutorHsnils = None
    approved: OptionalExecutorHsnils = None
    issued_position: str | None = Field(None, max_length=100)
    approved_position: str | None = Field(None, max_length=100)
    protocol_template_id: int | None = None
    samples: list[int] | None = None
    laboratory_id: int | None = None
    department_id: int | None = None


class ProtocolResponse(BaseModel):
    """Ответ API с данными протокола испытаний."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    test_protocol_number: str | None = Field(None, max_length=100, description="Номер протокола испытаний")
    test_protocol_date: date | None = Field(None, description="Дата протокола испытаний")
    is_accredited: bool = Field(default=False, description="Признак аккредитации протокола")
    sampling_act_number: SamplingActNumber = Field(..., description="Номер акта отбора")
    issued: OptionalExecutorHsnils = Field(None, description="hsnils лица, оформившего протокол")
    approved: OptionalExecutorHsnils = Field(None, description="hsnils лица, утвердившего протокол")
    issued_position: str | None = Field(None, max_length=100, description="Должность оформившего")
    approved_position: str | None = Field(None, max_length=100, description="Должность утвердившего")
    samples: list[int] | None = Field(None, description="Массив ID проб, привязанных к протоколу")
    laboratory_id: int
    department_id: int | None = None
    protocol_template_id: int | None = None
    laboratory: Any = Field(default=None, exclude=True)
    department: Any = Field(default=None, exclude=True)
    samples_data: list[SampleResponse] | None = None
    formatted_protocol_number: str | None = None
    has_undeleted_calculations: bool | None = None
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


class ProtocolTemplateBase(BaseModel):
    """Общие поля шаблона протокола."""

    name: Annotated[NonEmptyStr, Field(max_length=100)] = Field(..., description="Название шаблона")
    file_name: Annotated[NonEmptyStr, Field(max_length=100)] = Field(..., description="Оригинальное имя файла")


class ProtocolTemplateCreate(ProtocolTemplateBase):
    """Запрос на создание шаблона протокола."""

    file: NonEmptyStr = Field(..., description="xlsx файл (base64 или путь)")
    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: int | None = Field(None, description="ID подразделения")


class ProtocolTemplateUpdate(BaseModel):
    """Частичное обновление шаблона протокола."""

    name: OptionalNonEmptyStr = Field(None, max_length=100)
    file: OptionalNonEmptyStr = None
    file_name: OptionalNonEmptyStr = Field(None, max_length=100)


class ProtocolTemplateResponse(ProtocolTemplateBase):
    """Ответ API с данными шаблона протокола."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    version: str
    laboratory_id: int
    department_id: int | None = None
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


class ExcelCellStyle(BaseModel):
    """Стиль ячейки редактора шапки шаблона."""

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    font_weight: str = Field(default="normal", alias="fontWeight")
    font_style: str = Field(default="normal", alias="fontStyle")
    font_size: str = Field(default="14px", alias="fontSize")
    font_family: str | None = Field(default=None, alias="fontFamily")
    text_align: str = Field(default="center", alias="textAlign")


class ExcelStylesResponse(BaseModel):
    """Стили ячеек секции Excel-шаблона."""

    styles: dict[str, ExcelCellStyle] = Field(
        default_factory=dict,
        description="Стили ячеек: ключ — координата вида 'row-col'",
    )


class SaveExcelSectionResponse(BaseModel):
    """Результат сохранения секции Excel-шаблона."""

    message: str | None = Field(default=None, description="Текстовый статус операции")
    version: str | None = Field(default=None, description="Новая версия шаблона")
    template_id: int | None = Field(default=None, description="ID созданной версии шаблона")
