from __future__ import annotations
from datetime import date, datetime
from typing import Annotated, Any
from pydantic import AfterValidator, BaseModel, ConfigDict, Field, computed_field
from models.report import ReportType
from schemas.common import NonEmptyStr, OptionalNonEmptyStr, make_enum_validator, related_entity_name

_validate_report_type = make_enum_validator(ReportType, "Тип отчёта")
ReportTypeField = Annotated[str, AfterValidator(_validate_report_type)]


class ReportTemplateBase(BaseModel):
    """Общие поля шаблона отчёта."""

    report_type: Annotated[ReportTypeField, Field(max_length=255)] = Field(..., description="Тип отчёта")
    file_name: Annotated[NonEmptyStr, Field(max_length=255)] = Field(..., description="Оригинальное имя файла")


class ReportTemplateCreate(ReportTemplateBase):
    """Запрос на создание шаблона отчёта."""

    file: NonEmptyStr = Field(..., description="Файл (base64)")
    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: int | None = Field(None, description="ID подразделения")


class ReportTemplateUpdate(BaseModel):
    """Частичное обновление шаблона отчёта."""

    report_type: Annotated[ReportTypeField, Field(max_length=255)] | None = None
    file: OptionalNonEmptyStr = None
    file_name: OptionalNonEmptyStr = Field(None, max_length=255)


class ReportTemplateResponse(ReportTemplateBase):
    """Ответ API с данными шаблона отчёта."""

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


class GenerateSampleCountReportRequest(BaseModel):
    """Параметры формирования отчёта «Количество проб» (ИЛНиНМ)."""

    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: int | None = Field(
        None,
        description="ID подразделения; пробы фильтруются по laboratory_id и department_id",
    )
    template_id: int | None = Field(
        None,
        description="ID шаблона; если не указан — последний для типа «Количество проб»",
    )
    date_from: date = Field(..., description="Начало периода по дате получения пробы (YYYY-MM-DD)")
    date_to: date = Field(..., description="Конец периода по дате получения пробы (YYYY-MM-DD)")


class GeneratePhysicochemicalReportRequest(BaseModel):
    """Параметры формирования отчёта «Физико-химическая характеристика» (ИЛНиНМ)."""

    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: int | None = Field(
        None,
        description="ID подразделения; пробы фильтруются по laboratory_id и department_id",
    )
    template_id: int | None = Field(
        None,
        description=("ID шаблона; если не указан — последний для типа «Физико-химическая характеристика»"),
    )
    date_from: date = Field(..., description="Начало периода по дате отбора пробы (YYYY-MM-DD)")
    date_to: date = Field(..., description="Конец периода по дате отбора пробы (YYYY-MM-DD)")
    sampling_location: NonEmptyStr = Field(
        ...,
        description="Место отбора: «ЦДГГКН №1», «ЦДГГКН №2» или имя цеха в справочнике",
    )


class GenerateKgsReportRequest(BaseModel):
    """Параметры формирования отчёта «Результаты КГС» (ИЛНиНМ)."""

    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: int | None = Field(
        None,
        description="ID подразделения; пробы фильтруются по laboratory_id и department_id",
    )
    template_id: int | None = Field(
        None,
        description="ID шаблона; если не указан — последний для типа «Результаты КГС»",
    )
    date_from: date = Field(..., description="Начало периода по дате отбора пробы (YYYY-MM-DD)")
    date_to: date = Field(..., description="Конец периода по дате отбора пробы (YYYY-MM-DD)")


class GenerateNksReportRequest(BaseModel):
    """Параметры формирования отчёта «Результаты НКС» (ИЛНиНМ)."""

    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: int | None = Field(
        None,
        description="ID подразделения; пробы фильтруются по laboratory_id и department_id",
    )
    template_id: int | None = Field(
        None,
        description="ID шаблона; если не указан — последний для типа «Результаты НКС»",
    )
    date_from: date = Field(..., description="Начало периода по дате отбора пробы (YYYY-MM-DD)")
    date_to: date = Field(..., description="Конец периода по дате отбора пробы (YYYY-MM-DD)")
    report_month: int = Field(..., ge=1, le=12, description="Месяц отчёта")
    report_year: int = Field(..., ge=1900, le=2100, description="Год отчёта")
