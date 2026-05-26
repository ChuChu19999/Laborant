from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from models.report import ReportType


class ReportTemplateBase(BaseModel):
    report_type: str = Field(..., max_length=255, description="Тип отчёта")
    file_name: str = Field(..., max_length=255, description="Оригинальное имя файла")

    @field_validator("report_type")
    @classmethod
    def validate_report_type(cls, v: str) -> str:
        valid_types = [rt.value for rt in ReportType]
        if v not in valid_types:
            raise ValueError(
                f"Тип отчёта должен быть одним из: {', '.join(valid_types)}"
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
                    f"Тип отчёта должен быть одним из: {', '.join(valid_types)}"
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


class GenerateSampleCountReportRequest(BaseModel):
    """Параметры формирования отчёта «Количество проб» (ИЛНиНМ)."""

    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: Optional[int] = Field(
        None,
        description="ID подразделения; пробы фильтруются по laboratory_id и department_id",
    )
    template_id: Optional[int] = Field(
        None,
        description="ID шаблона; если не указан — последний для типа «Количество проб»",
    )
    date_from: str = Field(
        ..., description="Начало периода по дате получения пробы (YYYY-MM-DD)"
    )
    date_to: str = Field(
        ..., description="Конец периода по дате получения пробы (YYYY-MM-DD)"
    )


class GeneratePhysicochemicalReportRequest(BaseModel):
    """Параметры формирования отчёта «Физико-химическая характеристика» (ИЛНиНМ)."""

    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: Optional[int] = Field(
        None,
        description="ID подразделения; пробы фильтруются по laboratory_id и department_id",
    )
    template_id: Optional[int] = Field(
        None,
        description=(
            "ID шаблона; если не указан — последний для типа "
            "«Физико-химическая характеристика»"
        ),
    )
    date_from: str = Field(
        ..., description="Начало периода по дате отбора пробы (YYYY-MM-DD)"
    )
    date_to: str = Field(
        ..., description="Конец периода по дате отбора пробы (YYYY-MM-DD)"
    )
    sampling_location: str = Field(
        ...,
        description="Место отбора: «ЦДГГКН №1», «ЦДГГКН №2» или имя цеха в справочнике",
    )

    @field_validator("sampling_location")
    @classmethod
    def validate_sampling_location(cls, v: str) -> str:
        from services.ilninm_reports.physicochemical import (
            resolve_sampling_location_db_name,
        )

        resolve_sampling_location_db_name(v)
        return v.strip()
