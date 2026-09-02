from __future__ import annotations
from typing import Any

VOLUME_DISTILLATE_FIELD = "Объёмная доля отгона"
VOLUME_RESIDUE_FIELD = "Объёмная доля остатка"
VOLUME_LOSSES_FIELD = "Объёмная доля потерь"

_FRACTIONAL_CARD_FIELD_ALIASES: dict[str, tuple[str, ...]] = {
    VOLUME_DISTILLATE_FIELD: (VOLUME_DISTILLATE_FIELD, "Объемная доля отгона"),
    VOLUME_RESIDUE_FIELD: (VOLUME_RESIDUE_FIELD, "Объемная доля остатка"),
}


def normalize_fractional_key(key: str) -> str:
    """Привести название показателя фракционного состава к каноническому виду."""
    normalized = key.replace("н,к.", "н.к.")
    return normalized.replace("Объемная", "Объёмная")


def get_fractional_card_value(card: dict[str, Any], field_name: str, default: str = "0") -> Any:
    """Вернуть значение поля карточки фракционного состава с учётом legacy-ключей."""
    aliases = _FRACTIONAL_CARD_FIELD_ALIASES.get(field_name, (field_name,))
    for alias in aliases:
        if alias in card:
            return card[alias]
    return default


__all__ = [
    "VOLUME_DISTILLATE_FIELD",
    "VOLUME_LOSSES_FIELD",
    "VOLUME_RESIDUE_FIELD",
    "get_fractional_card_value",
    "normalize_fractional_key",
]
