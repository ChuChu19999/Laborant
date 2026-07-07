from __future__ import annotations
from typing import Any
from pydantic import BaseModel, Field
from schemas.sample import SampleResponse


class ResearchMethodExportInfo(BaseModel):
    id: int
    name: str
    unit: str | None = None
    sort_order: int | None = None
    is_group_member: bool = False
    groups: list[dict[str, Any]] = Field(default_factory=list)
    input_data: dict[str, Any] | None = None


class SampleExportCalculation(BaseModel):
    id: int
    research_method_id: int
    input_data: dict[str, Any]
    result: str
    measurement_error: str | None = None
    unit: str | None = None
    research_method: ResearchMethodExportInfo | None = None


class SampleExportItem(SampleResponse):
    calculations: list[SampleExportCalculation] = Field(default_factory=list)


class SamplesExportResponse(BaseModel):
    items: list[SampleExportItem]
    total: int
