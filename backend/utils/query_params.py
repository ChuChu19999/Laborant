import pendulum
from utils.parsers import parse_query_datetime


def parse_date_range_params(
    date_from: str | None,
    date_to: str | None,
) -> tuple[pendulum.DateTime | None, pendulum.DateTime | None]:
    """Парсинг параметров диапазона дат из строк."""
    parsed_date_from = parse_query_datetime(date_from) if date_from else None
    parsed_date_to = parse_query_datetime(date_to) if date_to else None
    return parsed_date_from, parsed_date_to
