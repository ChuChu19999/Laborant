from __future__ import annotations
from datetime import datetime
from typing import Literal
import pendulum

MonitoringPeriodValue = Literal["24h", "7d", "30d", "all"]
MONITORING_CLEANUP_RESOLVED_DAYS = 90


DEFAULT_MONITORING_PERIOD: MonitoringPeriodValue = "24h"
MONITORING_PERIOD_QUERY_PATTERN = "^(24h|7d|30d|all)$"


def resolve_monitoring_period_since(period: MonitoringPeriodValue) -> datetime | None:
    """Вернуть момент начала периода для фильтра мониторинга; для all — без ограничения."""
    if period == "all":
        return None
    now = pendulum.now("UTC")
    if period == "7d":
        return now.subtract(days=7)
    if period == "30d":
        return now.subtract(days=30)
    return now.subtract(hours=24)
