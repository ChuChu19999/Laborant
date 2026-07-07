from __future__ import annotations
from datetime import date, datetime
from typing import Annotated, Any
from pydantic import BaseModel, ConfigDict, Field
from schemas.common import NonEmptyStr, OptionalNonEmptyStr

SamplingActNumber = Annotated[NonEmptyStr, Field(max_length=50)]


class ProtocolBase(BaseModel):
    test_protocol_number: str | None = Field(
        None, max_length=100, description="Номер протокола испытаний"
    )
    test_protocol_date: date | None = Field(
        None, description="Дата протокола испытаний"
    )
    is_accredited: bool = Field(
        default=False, description="Признак аккредитации протокола"
    )
    sampling_act_number: SamplingActNumber = Field(..., description="Номер акта отбора")
    issued: str | None = Field(
        None, max_length=150, description="hsnils лица, оформившего протокол"
    )
    approved: str | None = Field(
        None, max_length=150, description="hsnils лица, утвердившего протокол"
    )
    issued_position: str | None = Field(
        None, max_length=100, description="Должность оформившего"
    )
    approved_position: str | None = Field(
        None, max_length=100, description="Должность утвердившего"
    )
    samples: list[int] | None = Field(
        None, description="Массив ID проб, привязанных к протоколу"
    )


class ProtocolCreate(ProtocolBase):
    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: int | None = Field(None, description="ID подразделения")
    protocol_template_id: int | None = Field(None, description="ID шаблона протокола")


class ProtocolUpdate(BaseModel):
    test_protocol_number: str | None = Field(None, max_length=100)
    test_protocol_date: date | None = None
    is_accredited: bool | None = None
    sampling_act_number: Annotated[OptionalNonEmptyStr, Field(max_length=50)] = None
    issued: str | None = Field(None, max_length=150)
    approved: str | None = Field(None, max_length=150)
    issued_position: str | None = Field(None, max_length=100)
    approved_position: str | None = Field(None, max_length=100)
    protocol_template_id: int | None = None
    samples: list[int] | None = None
    laboratory_id: int | None = None
    department_id: int | None = None


class ProtocolResponse(ProtocolBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    laboratory_id: int
    department_id: int | None = None
    protocol_template_id: int | None = None
    laboratory_name: str | None = None
    department_name: str | None = None
    samples_data: list[dict[str, Any]] | None = None
    formatted_protocol_number: str | None = None
    has_undeleted_calculations: bool | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class ProtocolTemplateBase(BaseModel):
    name: str = Field(..., max_length=100, description="Название шаблона")
    file_name: str = Field(..., max_length=100, description="Оригинальное имя файла")
    accreditation_header_row: int | None = Field(
        None, description="Строка шапки аккредитации"
    )


class ProtocolTemplateCreate(ProtocolTemplateBase):
    file: str = Field(..., description="xlsx файл (base64 или путь)")
    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: int | None = Field(None, description="ID подразделения")


class ProtocolTemplateUpdate(BaseModel):
    name: str | None = Field(None, max_length=100)
    file: str | None = None
    file_name: str | None = Field(None, max_length=100)
    accreditation_header_row: int | None = None


class ProtocolTemplateResponse(ProtocolTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    version: str
    laboratory_id: int
    department_id: int | None = None
    laboratory_name: str | None = None
    department_name: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
