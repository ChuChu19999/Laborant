import pendulum
from utils.date import _parse_pendulum


def parse_query_datetime(date_str: str | None) -> pendulum.DateTime | None:
    """Парсинг даты из query-параметров API: naive, без логирования."""
    if not date_str:
        return None
    try:
        return _parse_pendulum(date_str, naive=True)
    except Exception:
        return None
