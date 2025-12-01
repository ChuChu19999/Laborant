from typing import Optional
import pendulum
from utils.parsers import parse_date_string


def parse_date_range_params(
    date_from: Optional[str],
    date_to: Optional[str],
) -> tuple[Optional[pendulum.DateTime], Optional[pendulum.DateTime]]:
    """
    Парсинг параметров диапазона дат из строк.
    """
    parsed_date_from = parse_date_string(date_from) if date_from else None
    parsed_date_to = parse_date_string(date_to) if date_to else None
    return parsed_date_from, parsed_date_to
