from typing import Optional
import pendulum


def parse_date_string(date_str: Optional[str]) -> Optional[pendulum.DateTime]:
    """
    Парсинг строки даты в pendulum.DateTime.
    """
    if not date_str:
        return None
    try:
        return pendulum.parse(date_str).naive()
    except Exception:
        return None


def parse_date_only_string(date_str: Optional[str]) -> Optional[pendulum.Date]:
    """
    Парсинг строки даты в pendulum.Date (только дата, без времени).
    """
    if not date_str:
        return None
    try:
        return pendulum.parse(date_str).date()
    except Exception:
        return None
