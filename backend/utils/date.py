from __future__ import annotations
from datetime import date, datetime
from typing import cast
import pendulum
from core.logger import logger


def _parse_pendulum(date_str: str, *, naive: bool) -> pendulum.DateTime:
    """Разобрать строку в pendulum.DateTime."""
    parsed = pendulum.parse(date_str.strip())
    assert isinstance(parsed, pendulum.DateTime)
    return parsed.naive() if naive else parsed


def ensure_datetime(value: object | None) -> pendulum.DateTime | None:
    """Привести date/datetime к pendulum.DateTime (UTC-aware, как в остальном проекте)."""
    if value is None:
        return None
    if isinstance(value, pendulum.DateTime):
        return value
    if isinstance(value, pendulum.Date):
        return pendulum.datetime(value.year, value.month, value.day)
    if isinstance(value, datetime):
        return cast(pendulum.DateTime, pendulum.instance(value))
    if isinstance(value, date):
        return pendulum.datetime(value.year, value.month, value.day)
    return None


def parse_datetime_string(date_str: str) -> pendulum.DateTime | None:
    """
    Разобрать строку даты через pendulum для services/scripts/HR.

    Без приведения к naive: результат timezone-aware (UTC).
    При ошибке формата — warning в лог и None.
    """
    if not date_str:
        return None

    try:
        return _parse_pendulum(date_str, naive=False)
    except (ValueError, TypeError, OverflowError) as e:
        logger.warning(f"Не удалось распарсить дату: {date_str}, ошибка: {e!s}")
        return None
