from __future__ import annotations
from typing import Any
from schemas.visibility import ScopeIdFilter


def normalize_visibility_scope(
    scope: ScopeIdFilter | dict[str, Any] | None,
) -> ScopeIdFilter:
    """Привести область видимости к виду со списками id лабораторий и подразделений."""
    if not scope or not isinstance(scope, dict):
        return {"laboratory_ids": [], "department_ids": []}

    laboratory_ids = scope.get("laboratory_ids") or []
    department_ids = scope.get("department_ids") or []

    return {
        "laboratory_ids": [int(item) for item in laboratory_ids if isinstance(item, int) and item > 0],
        "department_ids": [int(item) for item in department_ids if isinstance(item, int) and item > 0],
    }


def is_visible_in_scope(
    visibility_scope: ScopeIdFilter | dict[str, Any] | None,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> bool:
    """
    Пустая область видимости означает доступность везде.
    Подразделение в department_ids — видно только для этого подразделения.
    Лаборатория в laboratory_ids — видна для всей лаборатории (без подразделений).
    """
    scope = normalize_visibility_scope(visibility_scope)
    laboratory_ids = scope["laboratory_ids"]
    department_ids = scope["department_ids"]

    if not laboratory_ids and not department_ids:
        return True

    if department_id and department_id in department_ids:
        return True

    return bool(laboratory_id and laboratory_id in laboratory_ids)


__all__ = [
    "is_visible_in_scope",
    "normalize_visibility_scope",
]
