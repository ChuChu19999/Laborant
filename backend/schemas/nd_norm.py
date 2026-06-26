from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class NdNormMethodDataItem(BaseModel):
    method_id: int = Field(..., description="ID метода исследования")
    text: str = Field(default="", description="Текст нормы для метода")

    @field_validator("method_id")
    @classmethod
    def validate_method_id(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("ID метода должен быть положительным числом")
        return value

    @field_validator("text", mode="before")
    @classmethod
    def normalize_text(cls, value: Optional[str]) -> str:
        if value is None:
            return ""
        return str(value).strip()


class NdNormCreate(BaseModel):
    name: str = Field(..., max_length=255, description="Наименование нормы")
    test_object: str = Field(..., max_length=255, description="Объект испытаний")
    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: Optional[int] = Field(None, description="ID подразделения")
    method_data: List[NdNormMethodDataItem] = Field(
        default_factory=list,
        description="Тексты нормы по методам исследования",
    )

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Наименование нормы не может быть пустым")
        return value.strip()

    @field_validator("test_object")
    @classmethod
    def strip_test_object(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Объект испытаний не может быть пустым")
        return value.strip()


class NdNormUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    test_object: Optional[str] = Field(None, max_length=255)
    laboratory_id: Optional[int] = None
    department_id: Optional[int] = None
    method_data: Optional[List[NdNormMethodDataItem]] = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not value.strip():
            raise ValueError("Наименование нормы не может быть пустым")
        return value.strip()

    @field_validator("test_object", mode="before")
    @classmethod
    def strip_test_object(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not value.strip():
            raise ValueError("Объект испытаний не может быть пустым")
        return value.strip()


class NdNormResponse(BaseModel):
    id: int
    name: str
    test_object: str
    laboratory_id: int
    department_id: Optional[int] = None
    method_data: List[NdNormMethodDataItem] = Field(default_factory=list)
    laboratory_name: Optional[str] = None
    department_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True
