from contextvars import ContextVar
from typing import Optional, Tuple

# Context variable для хранения текущего пользователя (full_name и hsnils из токена)
current_user_context: ContextVar[Optional[Tuple[str, str]]] = ContextVar(
    "current_user", default=None
)


def set_current_user(full_name: str, hsnils: str) -> None:
    """Устанавливает текущего пользователя в контекст (full_name и hsnils)."""
    current_user_context.set((full_name, hsnils))


def get_current_user() -> Optional[Tuple[str, str]]:
    """Получает текущего пользователя из контекста (full_name, hsnils)."""
    return current_user_context.get()
