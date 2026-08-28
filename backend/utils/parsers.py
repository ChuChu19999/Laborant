from __future__ import annotations
import pendulum
from pendulum.parsing.exceptions import ParserError
from utils.date import _parse_pendulum


def parse_query_datetime(date_str: str | None) -> pendulum.DateTime | None:
    """Разобрать дату из query-параметров API."""
    if not date_str:
        return None
    try:
        return _parse_pendulum(date_str, naive=True)
    except ParserError:
        return None


def parse_sample_ids(sample_ids: str | None) -> list[int] | None:
    """Разобрать список ID проб из query-строки через запятую."""
    if not sample_ids:
        return None
    try:
        return [int(item.strip()) for item in sample_ids.split(",") if item.strip()]
    except ValueError as exc:
        raise ValueError("Некорректный формат sample_ids: ожидаются целые числа через запятую") from exc
