from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
from models.equipment import EquipmentType


class EquipmentBase(BaseModel):
    type: str = Field(..., description="Тип прибора или оборудования")
    name: str = Field(
        ..., max_length=255, description="Наименование прибора или оборудования"
    )
    serial_number: str = Field(
        ..., max_length=100, description="Заводской номер прибора или оборудования"
    )
    verification_info: str = Field(
        ..., max_length=255, description="Сведения о результатах поверки"
    )
    verification_date: date = Field(..., description="Дата поверки")
    verification_end_date: date = Field(
        ..., description="Дата окончания срока действия поверки"
    )
    version: str = Field(..., max_length=8, description="Версия прибора (например, v1)")

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        valid_types = [e.value for e in EquipmentType]
        if v not in valid_types:
            raise ValueError(
                f"Тип прибора должен быть одним из: {', '.join(valid_types)}"
            )
        return v

    @field_validator("name", "serial_number")
    @classmethod
    def strip_strings(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Поле не может быть пустым")
        return v.strip()


class EquipmentCreate(BaseModel):
    type: str = Field(..., description="Тип прибора или оборудования")
    name: str = Field(
        ..., max_length=255, description="Наименование прибора или оборудования"
    )
    serial_number: str = Field(
        ..., max_length=100, description="Заводской номер прибора или оборудования"
    )
    verification_info: str = Field(
        ..., max_length=255, description="Сведения о результатах поверки"
    )
    verification_date: date = Field(..., description="Дата поверки")
    verification_end_date: date = Field(
        ..., description="Дата окончания срока действия поверки"
    )
    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: Optional[int] = Field(None, description="ID подразделения")
    method_data_default: Optional[List[int]] = Field(
        None, description="Методы по умолчанию"
    )

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        valid_types = [e.value for e in EquipmentType]
        if v not in valid_types:
            raise ValueError(
                f"Тип прибора должен быть одним из: {', '.join(valid_types)}"
            )
        return v

    @field_validator("name", "serial_number")
    @classmethod
    def strip_strings(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Поле не может быть пустым")
        return v.strip()

    @field_validator("method_data_default")
    @classmethod
    def validate_method_data_default(
        cls, v: Optional[List[int]]
    ) -> Optional[List[int]]:
        if v is None:
            return []
        for item in v:
            if not isinstance(item, int) or item <= 0:
                raise ValueError(
                    "Каждый ID метода должен быть положительным целым числом"
                )
        return v


class EquipmentUpdate(BaseModel):
    type: Optional[str] = None
    name: Optional[str] = Field(None, max_length=255)
    serial_number: Optional[str] = Field(None, max_length=100)
    verification_info: Optional[str] = Field(None, max_length=255)
    verification_date: Optional[date] = None
    verification_end_date: Optional[date] = None
    version: Optional[str] = Field(None, max_length=8)
    laboratory_id: Optional[int] = None
    department_id: Optional[int] = None
    method_data_default: Optional[List[int]] = None

    @field_validator("name", "serial_number", mode="before")
    @classmethod
    def strip_strings(cls, v: Optional[str]) -> Optional[str]:
        if v:
            if not v.strip():
                raise ValueError("Поле не может быть пустым")
            return v.strip()
        return v

    @field_validator("type", mode="before")
    @classmethod
    def validate_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_types = [e.value for e in EquipmentType]
            if v not in valid_types:
                raise ValueError(
                    f"Тип прибора должен быть одним из: {', '.join(valid_types)}"
                )
        return v

    @field_validator("method_data_default", mode="before")
    @classmethod
    def validate_method_data_default(
        cls, v: Optional[List[int]]
    ) -> Optional[List[int]]:
        if v is None:
            return None
        for item in v:
            if not isinstance(item, int) or item <= 0:
                raise ValueError(
                    "Каждый ID метода должен быть положительным целым числом"
                )
        return v


class EquipmentResponse(EquipmentBase):
    id: int
    laboratory_id: int
    department_id: Optional[int] = None
    method_data_default: Optional[List[int]] = None
    laboratory_name: Optional[str] = None
    department_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True
