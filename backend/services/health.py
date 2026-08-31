from __future__ import annotations
from sqlalchemy.ext.asyncio import AsyncSession
from schemas.meta import HealthResponse
from utils.database_health import measure_database_health


async def get_application_health(db: AsyncSession) -> HealthResponse:
    """Проверить доступность PostgreSQL и собрать ответ health-check."""
    status_value, db_latency_ms = await measure_database_health(db)
    return HealthResponse(status=status_value, db_latency_ms=db_latency_ms)
