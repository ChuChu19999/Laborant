from __future__ import annotations
from datetime import date
import pendulum
from utils.protocol_suffix_rules import get_protocol_object_suffix


def format_protocol_number(
    number: str | None,
    protocol_date: date | pendulum.Date | None,
    is_accredited: bool,
    test_object: str | None = None,
) -> str:
    """
    Форматирует номер протокола для отображения.

    Логика:
    - Если нет номера и даты - возвращает '-'
    - Если не аккредитован - возвращает номер или '-'
    - Если аккредитован:
      - Определяет суффикс на основе test_object
      - Форматирует дату в DD.MM.YYYY
      - Если нет номера - возвращает "от {дата}"
      - Если нет даты - возвращает номер
      - Иначе: "{номер}/07/{суффикс} от {дата}" или "{номер}/07 от {дата}"
    """
    if not number and not protocol_date:
        return "-"

    if not is_accredited:
        return number or "-"

    suffix = get_protocol_object_suffix(test_object)

    if protocol_date:
        if isinstance(protocol_date, pendulum.Date):
            formatted_date = protocol_date.format("DD.MM.YYYY")
        elif isinstance(protocol_date, date):
            pendulum_date = pendulum.date(
                protocol_date.year, protocol_date.month, protocol_date.day
            )
            formatted_date = pendulum_date.format("DD.MM.YYYY")
        else:
            try:
                pendulum_date = pendulum.instance(protocol_date).date()
                formatted_date = pendulum_date.format("DD.MM.YYYY")
            except Exception:
                formatted_date = None
    else:
        formatted_date = None

    if not number:
        return f"от {formatted_date}" if formatted_date else "-"

    if not formatted_date:
        return number

    protocol_number = f"{number}/07/{suffix}" if suffix else f"{number}/07"
    return f"{protocol_number} от {formatted_date}"
