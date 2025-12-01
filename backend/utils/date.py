from datetime import date
from typing import Optional
import pendulum
from core.logger import logger


def parse_date(date_str: str) -> date:
    """
    Парсинг даты из строки формата YYYY-MM-DD с использованием pendulum.
    """
    return pendulum.parse(date_str).date()


def ensure_datetime(value) -> Optional[pendulum.DateTime]:
    """
    Приводит объект date или datetime к pendulum.DateTime.
    """
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
            else:
                return pendulum.datetime(value.year, value.month, value.day)
        except Exception:
            return None
    return None


def parse_date_string(date_str: str) -> Optional[pendulum.DateTime]:
    """
    Парсит строку даты в различных форматах с использованием pendulum.
    """
    if not date_str:
        return None

    try:
        date_str = date_str.strip()
        return pendulum.parse(date_str)
    except Exception as e:
        logger.warning(f"Не удалось распарсить дату: {date_str}, ошибка: {str(e)}")
        return None
