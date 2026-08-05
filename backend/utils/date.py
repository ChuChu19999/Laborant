import pendulum
from core.logger import logger


def _parse_pendulum(date_str: str, *, naive: bool) -> pendulum.DateTime:
    """Общий парсинг строки в pendulum.DateTime."""
    parsed = pendulum.parse(date_str.strip())
    return parsed.naive() if naive else parsed


def ensure_datetime(value) -> pendulum.DateTime | None:
    """Приводит объект date или datetime к pendulum.DateTime."""
    if value is None:
        return None
    if isinstance(value, pendulum.DateTime):
        return value
    if isinstance(value, pendulum.Date):
        return pendulum.datetime(value.year, value.month, value.day)
    if hasattr(value, "year") and hasattr(value, "month") and hasattr(value, "day"):
        try:
            if hasattr(value, "hour"):
                return pendulum.instance(value)
            return pendulum.datetime(value.year, value.month, value.day)
        except Exception:
            return None
    return None


def parse_datetime_string(date_str: str) -> pendulum.DateTime | None:
    """
    Парсит строку даты в различных форматах с использованием pendulum.
    Для HR и скриптов: с логированием ошибок, без приведения к naive.
    """
    if not date_str:
        return None

    try:
        return _parse_pendulum(date_str, naive=False)
    except Exception as e:
        logger.warning(f"Не удалось распарсить дату: {date_str}, ошибка: {str(e)}")
        return None
