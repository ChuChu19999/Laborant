from __future__ import annotations
from contextvars import ContextVar

current_user_context: ContextVar[tuple[str, str] | None] = ContextVar("current_user", default=None)


def set_current_user(full_name: str, hsnils: str) -> None:
    """Установить текущего пользователя в контекст (full_name и hsnils)."""
    current_user_context.set((full_name, hsnils))


def get_current_user() -> tuple[str, str] | None:
    """Получить текущего пользователя из контекста (full_name, hsnils)."""
    return current_user_context.get()
