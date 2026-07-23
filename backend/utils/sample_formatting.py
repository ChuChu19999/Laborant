from __future__ import annotations

# Префикс номера скважины в месте отбора.
WELL_DISPLAY_PREFIX = "скв. №"


def format_well_display(well: str | None) -> str | None:
    """Форматирует скважину для отображения: «скв. №{номер}»."""
    if not well or not well.strip():
        return None
    return f"{WELL_DISPLAY_PREFIX}{well.strip()}"
