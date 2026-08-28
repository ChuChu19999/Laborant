from __future__ import annotations


def normalize_fractional_key(key: str) -> str:
    """Исправляет опечатку «н,к.» → «н.к.» в названии показателя."""
    return key.replace("н,к.", "н.к.")


__all__ = ["normalize_fractional_key"]
