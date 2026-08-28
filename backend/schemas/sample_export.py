from __future__ import annotations
from typing import Any
from pydantic import BaseModel, Field
from schemas.sample import SampleResponse


class ResearchMethodGroupExportInfo(BaseModel):
    """Краткие сведения о группе метода в экспорте проб."""

    id: int
    name: str


class ResearchMethodExportInfo(BaseModel):
    """Сведения о методе исследования в экспорте проб."""

    id: int
    name: str
    unit: str | None = None
    sort_order: int | None = None
    is_group_member: bool = False
    groups: list[ResearchMethodGroupExportInfo] = Field(default_factory=list)
    input_data: dict[str, Any] | None = None


class SampleExportCalculation(BaseModel):
    """Расчёт пробы в составе данных экспорта."""

    id: int
    research_method_id: int
    input_data: dict[str, Any]
    result: str
    measurement_error: str | None = None
    unit: str | None = None
    research_method: ResearchMethodExportInfo | None = None


class SampleExportItem(SampleResponse):
    """Проба с привязанными расчётами для экспорта."""

    calculations: list[SampleExportCalculation] = Field(default_factory=list)


class SamplesExportResponse(BaseModel):
    """Ответ API со списком проб для экспорта."""

    items: list[SampleExportItem]
    total: int
