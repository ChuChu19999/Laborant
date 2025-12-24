from datetime import date
from typing import Optional, Union
import pendulum


def format_protocol_number(
    number: Optional[str],
    protocol_date: Optional[Union[date, pendulum.Date]],
    is_accredited: bool,
    test_object: Optional[str] = None,
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

    def get_object_suffix(test_obj: Optional[str]) -> str:
        """Определяет суффикс на основе объекта исследования."""
        if not test_obj:
            return ""

        test_object_lower = test_obj.lower()
        if "дегазированный конденсат" in test_object_lower:
            return "дк"
        if "нефть" in test_object_lower or "нефть калибровочная" in test_object_lower:
            return "н"
        if "нефтеконденсатная смесь" in test_object_lower:
            return "нкс"
        if "дизельное топливо" in test_object_lower:
            return "дт"
        if "отработанные нефтепродукты" in test_object_lower:
            return "он"
        if "масло турбинное" in test_object_lower:
            return "м"
        if "масло авиационное" in test_object_lower:
            return "м"
        if "смесь жидких углеводородов" in test_object_lower:
            return "с"
        if "ингибитор коррозии" in test_object_lower:
            return "ик"
        return ""

    suffix = get_object_suffix(test_object)

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
