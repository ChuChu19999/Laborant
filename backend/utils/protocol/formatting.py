from __future__ import annotations
from datetime import date
import pendulum
from pendulum.parsing.exceptions import ParserError
from utils.protocol.display_rules import (
    PROTOCOL_DATE_ONLY_PREFIX,
    PROTOCOL_DATE_SEPARATOR,
    PROTOCOL_DISPLAY_EMPTY,
    build_accredited_protocol_number,
)


def format_protocol_display(
    number: str | None,
    protocol_date: date | pendulum.Date | None,
    is_accredited: bool,
    protocol_abbreviation: str | None = None,
) -> str:
    """
    Собрать номер протокола для отображения.

    Без номера и даты — «-»; неаккредитованный — номер или «-»;
    аккредитованный — «N/07[/ABB] от DD.MM.YYYY» (или частичный вариант).
    """
    if not number and not protocol_date:
        return PROTOCOL_DISPLAY_EMPTY

    if not is_accredited:
        return number or PROTOCOL_DISPLAY_EMPTY

    if protocol_date:
        if isinstance(protocol_date, pendulum.Date):
            formatted_date = protocol_date.format("DD.MM.YYYY")
        elif isinstance(protocol_date, date):
            pendulum_date = pendulum.date(protocol_date.year, protocol_date.month, protocol_date.day)
            formatted_date = pendulum_date.format("DD.MM.YYYY")
        else:
            try:
                pendulum_date = pendulum.instance(protocol_date).date()
                formatted_date = pendulum_date.format("DD.MM.YYYY")
            except ParserError:
                formatted_date = None
    else:
        formatted_date = None

    if not number:
        return f"{PROTOCOL_DATE_ONLY_PREFIX}{formatted_date}" if formatted_date else PROTOCOL_DISPLAY_EMPTY

    if not formatted_date:
        return number

    protocol_number = build_accredited_protocol_number(number, protocol_abbreviation)
    return f"{protocol_number}{PROTOCOL_DATE_SEPARATOR}{formatted_date}"
