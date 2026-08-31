from __future__ import annotations
from pydantic import BaseModel, Field


class ApiEndpointItem(BaseModel):
    """Эндпоинт API с HTTP-методом и путём."""

    method: str
    path: str


class ApiIndexResponse(BaseModel):
    """Список доступных эндпоинтов приложения."""

    message: str = Field(default="Laborant API")
    endpoints: list[ApiEndpointItem]
    total: int


class HealthResponse(BaseModel):
    """Статус работоспособности приложения."""

    status: str
    db_latency_ms: float | None = None
