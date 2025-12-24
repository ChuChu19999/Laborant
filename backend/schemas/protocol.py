from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class ProtocolBase(BaseModel):
    test_protocol_number: Optional[str] = Field(
        None, max_length=100, description="Номер протокола испытаний"
    )
    test_protocol_date: Optional[date] = Field(
        None, description="Дата протокола испытаний"
    )
    is_accredited: bool = Field(
        default=False, description="Признак аккредитации протокола"
    )
    sampling_act_number: str = Field(
        ..., max_length=50, description="Номер акта отбора"
    )
    issued: Optional[str] = Field(
        None, max_length=150, description="hsnils лица, оформившего протокол"
    )
    approved: Optional[str] = Field(
        None, max_length=150, description="hsnils лица, утвердившего протокол"
    )
    issued_position: Optional[str] = Field(
        None, max_length=100, description="Должность оформившего"
    )
    approved_position: Optional[str] = Field(
        None, max_length=100, description="Должность утвердившего"
    )
    samples: Optional[List[int]] = Field(
        None, description="Массив ID проб, привязанных к протоколу"
    )


class ProtocolCreate(ProtocolBase):
    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: Optional[int] = Field(None, description="ID подразделения")
    protocol_template_id: Optional[int] = Field(
        None, description="ID шаблона протокола"
    )

    @field_validator("samples")
    @classmethod
    def validate_samples(cls, v: Optional[List[int]]) -> Optional[List[int]]:
        return v


class ProtocolUpdate(BaseModel):
    test_protocol_number: Optional[str] = Field(None, max_length=100)
    test_protocol_date: Optional[date] = None
    is_accredited: Optional[bool] = None
    sampling_act_number: Optional[str] = Field(None, max_length=50)
    issued: Optional[str] = Field(None, max_length=150)
    approved: Optional[str] = Field(None, max_length=150)
    issued_position: Optional[str] = Field(None, max_length=100)
    approved_position: Optional[str] = Field(None, max_length=100)
    protocol_template_id: Optional[int] = None
    samples: Optional[List[int]] = None
    laboratory_id: Optional[int] = None
    department_id: Optional[int] = None


class ProtocolResponse(ProtocolBase):
    id: int
    laboratory_id: int
    department_id: Optional[int] = None
    protocol_template_id: Optional[int] = None
    laboratory_name: Optional[str] = None
    department_name: Optional[str] = None
    samples_data: Optional[List[Dict[str, Any]]] = None
    formatted_protocol_number: Optional[str] = None
    has_undeleted_calculations: Optional[bool] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProtocolTemplateBase(BaseModel):
    name: str = Field(..., max_length=100, description="Название шаблона")
    file_name: str = Field(..., max_length=100, description="Оригинальное имя файла")
    accreditation_header_row: Optional[int] = Field(
        None, description="Строка шапки аккредитации"
    )


class ProtocolTemplateCreate(ProtocolTemplateBase):
    file: str = Field(..., description="xlsx файл (base64 или путь)")
    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: Optional[int] = Field(None, description="ID подразделения")


class ProtocolTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    file: Optional[str] = None
    file_name: Optional[str] = Field(None, max_length=100)
    accreditation_header_row: Optional[int] = None


class ProtocolTemplateResponse(ProtocolTemplateBase):
    id: int
    version: str
    laboratory_id: int
    department_id: Optional[int] = None
    laboratory_name: Optional[str] = None
    department_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True
