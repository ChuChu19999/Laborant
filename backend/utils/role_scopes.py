from __future__ import annotations
from typing import Any
from schemas.visibility import ScopeIdFilter
from utils.permissions_constants import merge_permissions, normalize_permissions


def _scope_key(laboratory_id: int, department_id: int | None) -> tuple[int, int | None]:
    """Собрать ключ области видимости для слияния scope роли."""
    return (laboratory_id, department_id)


def normalize_role_scope_entry(raw: dict[str, Any] | None) -> dict[str, Any] | None:
    """Привести одну привязку scope к каноническому виду или отбросить."""
    if not raw or not isinstance(raw, dict):
        return None
    laboratory_id = raw.get("laboratory_id")
    if not isinstance(laboratory_id, int) or laboratory_id <= 0:
        return None
    department_id = raw.get("department_id")
    if department_id is not None and (not isinstance(department_id, int) or department_id <= 0):
        department_id = None
    return {
        "laboratory_id": laboratory_id,
        "department_id": department_id,
        "permissions": normalize_permissions(raw.get("permissions")),
    }


def normalize_role_scopes(raw: list[Any] | None) -> list[dict[str, Any]]:
    """Нормализовать список привязок; дубликаты по (lab, dept) сливаются через OR."""
    if not raw or not isinstance(raw, list):
        return []

    by_key: dict[tuple[int, int | None], dict[str, Any]] = {}
    for item in raw:
        entry = normalize_role_scope_entry(item if isinstance(item, dict) else None)
        if entry is None:
            continue
        key = _scope_key(entry["laboratory_id"], entry["department_id"])
        existing = by_key.get(key)
        if existing is None:
            by_key[key] = entry
            continue
        by_key[key] = {
            "laboratory_id": entry["laboratory_id"],
            "department_id": entry["department_id"],
            "permissions": merge_permissions([existing["permissions"], entry["permissions"]]),
        }

    return sorted(
        by_key.values(),
        key=lambda item: (item["laboratory_id"], item["department_id"] or 0),
    )


def scopes_to_visibility_scope(scopes: list[dict[str, Any]]) -> ScopeIdFilter:
    """Собрать списки id лабораторий и подразделений из привязок."""
    laboratory_ids: set[int] = set()
    department_ids: set[int] = set()
    for entry in scopes:
        laboratory_ids.add(entry["laboratory_id"])
        department_id = entry.get("department_id")
        if isinstance(department_id, int) and department_id > 0:
            department_ids.add(department_id)
    return {
        "laboratory_ids": sorted(laboratory_ids),
        "department_ids": sorted(department_ids),
    }


def merge_role_scopes(
    scopes_lists: list[list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    """Объединить привязки нескольких ролей (OR прав внутри одного ключа)."""
    flattened: list[dict[str, Any]] = []
    for scopes in scopes_lists:
        flattened.extend(normalize_role_scopes(scopes))
    return normalize_role_scopes(flattened)


def role_scope_matches(
    scopes: list[dict[str, Any]],
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> bool:
    """
    Есть ли привязка на лабораторию/подразделение.
    Пустой список привязок — доступа нет.
    """
    normalized = normalize_role_scopes(scopes)
    if not normalized:
        return False
    if laboratory_id is None and department_id is None:
        return True

    if department_id is not None:
        if any(entry.get("department_id") == department_id for entry in normalized):
            return True
        return bool(
            laboratory_id is not None
            and any(
                entry["laboratory_id"] == laboratory_id and entry.get("department_id") is None for entry in normalized
            )
        )

    if laboratory_id is not None:
        return any(entry["laboratory_id"] == laboratory_id for entry in normalized)

    return False


def resolve_permissions_for_scope(
    scopes: list[dict[str, Any]],
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> dict[str, Any] | None:
    """Права для контекста lab/dept; None — нет подходящей привязки."""
    normalized = normalize_role_scopes(scopes)
    if not normalized:
        return None

    if laboratory_id is None and department_id is None:
        return merge_permissions([entry["permissions"] for entry in normalized])

    if department_id is not None:
        for entry in normalized:
            if entry.get("department_id") == department_id:
                return entry["permissions"]
        if laboratory_id is not None:
            for entry in normalized:
                if entry["laboratory_id"] == laboratory_id and entry.get("department_id") is None:
                    return entry["permissions"]
        return None

    if laboratory_id is not None:
        lab_level = [
            entry["permissions"]
            for entry in normalized
            if entry["laboratory_id"] == laboratory_id and entry.get("department_id") is None
        ]
        if lab_level:
            return merge_permissions(lab_level)
        lab_any = [entry["permissions"] for entry in normalized if entry["laboratory_id"] == laboratory_id]
        if lab_any:
            return merge_permissions(lab_any)
        return None

    return None


__all__ = [
    "merge_role_scopes",
    "normalize_role_scope_entry",
    "normalize_role_scopes",
    "resolve_permissions_for_scope",
    "role_scope_matches",
    "scopes_to_visibility_scope",
]
