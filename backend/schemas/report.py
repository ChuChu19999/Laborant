from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from models.report import ReportType


class ReportTemplateBase(BaseModel):
    report_type: str = Field(..., max_length=255, description="Тип отчета")
    file_name: str = Field(..., max_length=255, description="Оригинальное имя файла")

    @field_validator("report_type")
    @classmethod
    def validate_report_type(cls, v: str) -> str:
        valid_types = [rt.value for rt in ReportType]
        if v not in valid_types:
            raise ValueError(
                f"Тип отчета должен быть одним из: {', '.join(valid_types)}"
            )
        return v


class ReportTemplateCreate(ReportTemplateBase):
    file: str = Field(..., description="Файл (base64)")
    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: Optional[int] = Field(None, description="ID подразделения")


class ReportTemplateUpdate(BaseModel):
    report_type: Optional[str] = Field(None, max_length=255)
    file: Optional[str] = None
    file_name: Optional[str] = Field(None, max_length=255)

    @field_validator("report_type")
    @classmethod
    def validate_report_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_types = [rt.value for rt in ReportType]
            if v not in valid_types:
                raise ValueError(
                    f"Тип отчета должен быть одним из: {', '.join(valid_types)}"
                )
        return v


class ReportTemplateResponse(ReportTemplateBase):
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
