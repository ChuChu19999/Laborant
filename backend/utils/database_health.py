from __future__ import annotations
from time import perf_counter
from typing import Literal
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

HealthStatusValue = Literal["ok", "degraded", "down"]
HEALTH_DEGRADED_LATENCY_MS = 500.0
_HEALTH_CHECK_ERRORS = (OSError, RuntimeError, SQLAlchemyError, TypeError, ValueError)


async def measure_database_health(db: AsyncSession) -> tuple[HealthStatusValue, float | None]:
    """Проверить доступность PostgreSQL и время ответа SELECT 1."""
    started = perf_counter()
    try:
        await db.execute(text("SELECT 1"))
        latency_ms = round((perf_counter() - started) * 1000, 1)
        if latency_ms > HEALTH_DEGRADED_LATENCY_MS:
            return "degraded", latency_ms
        return "ok", latency_ms
    except _HEALTH_CHECK_ERRORS:
        return "down", None
