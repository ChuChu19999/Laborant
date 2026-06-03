from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from schemas.sample import SampleResponse


class ResearchMethodExportInfo(BaseModel):
    id: int
    name: str
    unit: Optional[str] = None
    sort_order: Optional[int] = None
    is_group_member: bool = False
    groups: List[Dict[str, Any]] = Field(default_factory=list)
    input_data: Optional[Dict[str, Any]] = None


class SampleExportCalculation(BaseModel):
    id: int
    research_method_id: int
    input_data: Dict[str, Any]
    result: str
    measurement_error: Optional[str] = None
    unit: Optional[str] = None
    research_method: Optional[ResearchMethodExportInfo] = None


class SampleExportItem(SampleResponse):
    calculations: List[SampleExportCalculation] = Field(default_factory=list)


class SamplesExportResponse(BaseModel):
    items: List[SampleExportItem]
    total: int
