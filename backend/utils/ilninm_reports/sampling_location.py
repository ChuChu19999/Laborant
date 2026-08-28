from __future__ import annotations
from utils.ilninm_reports.constants import (
    DISPLAY_TO_DB_NAME_CDGGKN,
    SAMPLING_LOCATIONS_CDGGKN,
)


def resolve_sampling_location_db_name(sampling_location: str) -> str:
    """Преобразовать ЦДГГКН или имя из БД в имя места отбора для фильтра."""
    key = (sampling_location or "").strip()
    if key in DISPLAY_TO_DB_NAME_CDGGKN:
        return DISPLAY_TO_DB_NAME_CDGGKN[key]
    if key in SAMPLING_LOCATIONS_CDGGKN:
        return key
    raise ValueError("Место отбора должно быть «ЦДГГКН №1», «ЦДГГКН №2» или «Цех по ДГГКН №1», «Цех по ДГГКН №2»")
