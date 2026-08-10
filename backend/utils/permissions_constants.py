from __future__ import annotations
from copy import deepcopy
from typing import Any, Literal

SamplingTerminology = Literal["well_mode", "sampling_point"]

SAMPLE_OPTIONAL_FIELDS = (
    "sample_type",
    "branch",
    "sampling_location",
    "well",
    "well_mode",
    "sampling_date",
    "receipt_date",
)

SAMPLE_REQUIRED_FIELDS = (
    "registration_number",
    "test_object",
    "indicators_count",
    "added_by",
)

NAVIGATION_KEYS = (
    "home",
    "samples",
    "protocols",
    "equipment",
    "sampling_locations",
    "nd_norms",
    "refraction_tables",
    "test_objects",
)

CRUD_RESOURCES = (
    "protocols",
    "equipment",
    "sampling_locations",
    "nd_norms",
    "refraction_tables",
)


def default_role_permissions() -> dict[str, Any]:
    """Права по умолчанию для новой роли (всё закрыто)."""
    return {
        "navigation": {
            "home": True,
            **{key: False for key in NAVIGATION_KEYS if key != "home"},
        },
        "laboratory_management": {"access": False},
        "samples": {
            "visible_fields": [],
            "update": False,
            "delete": False,
        },
        "protocols": {"read": False, "create": False, "update": False, "delete": False},
        "equipment": {"read": False, "create": False, "update": False, "delete": False},
        "sampling_locations": {
            "read": False,
            "create": False,
            "update": False,
            "delete": False,
        },
        "nd_norms": {"read": False, "create": False, "update": False, "delete": False},
        "refraction_tables": {
            "read": False,
            "create": False,
            "update": False,
            "delete": False,
        },
        "test_objects": {
            "read": False,
            "create": False,
            "update": False,
            "delete": False,
        },
        "calculations": {
            "execute": False,
            "create": False,
            "update": False,
            "delete": False,
            "show_equipment": False,
        },
        "sampling_terminology": "well_mode",
    }


def full_admin_permissions() -> dict[str, Any]:
    """Полный доступ для admin."""
    perms = default_role_permissions()
    for key in NAVIGATION_KEYS:
        perms["navigation"][key] = True
    perms["laboratory_management"]["access"] = True
    perms["samples"]["visible_fields"] = list(SAMPLE_OPTIONAL_FIELDS)
    perms["samples"]["update"] = True
    perms["samples"]["delete"] = True
    for resource in CRUD_RESOURCES:
        perms[resource] = {
            "read": True,
            "create": True,
            "update": True,
            "delete": True,
        }
    perms["test_objects"] = {
        "read": True,
        "create": True,
        "update": True,
        "delete": True,
    }
    perms["calculations"] = {
        "execute": True,
        "create": True,
        "update": True,
        "delete": True,
        "show_equipment": True,
    }
    perms["sampling_terminology"] = "well_mode"
    return perms


def normalize_permissions(raw: dict[str, Any] | None) -> dict[str, Any]:
    """Привести permissions к каноническому виду с дефолтами."""
    base = default_role_permissions()
    if not raw or not isinstance(raw, dict):
        return base

    navigation = raw.get("navigation")
    if isinstance(navigation, dict):
        for key in NAVIGATION_KEYS:
            if key in navigation:
                base["navigation"][key] = bool(navigation[key])
    # Главная страница всегда доступна всем ролям.
    base["navigation"]["home"] = True
    # Объекты испытаний — только admin.
    base["navigation"]["test_objects"] = False
    base["test_objects"] = {
        "read": False,
        "create": False,
        "update": False,
        "delete": False,
    }

    lab_mgmt = raw.get("laboratory_management")
    if isinstance(lab_mgmt, dict) and "access" in lab_mgmt:
        base["laboratory_management"]["access"] = bool(lab_mgmt["access"])

    samples = raw.get("samples")
    if isinstance(samples, dict):
        fields = samples.get("visible_fields")
        if isinstance(fields, list):
            base["samples"]["visible_fields"] = [
                field for field in fields if isinstance(field, str) and field in SAMPLE_OPTIONAL_FIELDS
            ]
        if "update" in samples:
            base["samples"]["update"] = bool(samples["update"])
        if "delete" in samples:
            base["samples"]["delete"] = bool(samples["delete"])

    for resource in CRUD_RESOURCES:
        section = raw.get(resource)
        if isinstance(section, dict):
            for action in ("read", "create", "update", "delete"):
                if action in section:
                    base[resource][action] = bool(section[action])

    calculations = raw.get("calculations")
    if isinstance(calculations, dict):
        for action in ("execute", "create", "update", "delete", "show_equipment"):
            if action in calculations:
                base["calculations"][action] = bool(calculations[action])

    terminology = raw.get("sampling_terminology")
    if terminology in ("well_mode", "sampling_point"):
        base["sampling_terminology"] = terminology

    # Чтение каталога = доступ к вкладке; отдельный флаг read не настраивается.
    for resource in CRUD_RESOURCES:
        base[resource]["read"] = bool(base["navigation"].get(resource, False))

    return base


def merge_permissions(items: list[dict[str, Any]]) -> dict[str, Any]:
    """Объединить permissions нескольких ролей (OR / union)."""
    if not items:
        return default_role_permissions()

    result = deepcopy(normalize_permissions(items[0]))
    for item in items[1:]:
        other = normalize_permissions(item)
        for key in NAVIGATION_KEYS:
            result["navigation"][key] = result["navigation"][key] or other["navigation"][key]
        result["laboratory_management"]["access"] = (
            result["laboratory_management"]["access"] or other["laboratory_management"]["access"]
        )
        result["samples"]["update"] = result["samples"]["update"] or other["samples"]["update"]
        result["samples"]["delete"] = result["samples"]["delete"] or other["samples"]["delete"]
        result["samples"]["visible_fields"] = sorted(
            set(result["samples"]["visible_fields"]) | set(other["samples"]["visible_fields"])
        )
        for resource in CRUD_RESOURCES:
            for action in ("read", "create", "update", "delete"):
                result[resource][action] = result[resource][action] or other[resource][action]
        for action in ("execute", "create", "update", "delete", "show_equipment"):
            result["calculations"][action] = result["calculations"][action] or other["calculations"][action]
        # При расхождении терминологии приоритет у well_mode.
        if result["sampling_terminology"] != other["sampling_terminology"] and "well_mode" in (
            result["sampling_terminology"],
            other["sampling_terminology"],
        ):
            result["sampling_terminology"] = "well_mode"

    for resource in CRUD_RESOURCES:
        result[resource]["read"] = bool(result["navigation"].get(resource, False))

    return result


def has_permission(
    permissions: dict[str, Any] | None,
    resource: str,
    action: str,
) -> bool:
    """Проверить наличие конкретного права."""
    perms = normalize_permissions(permissions)
    if resource == "navigation":
        return bool(perms["navigation"].get(action, False))
    if resource == "laboratory_management":
        return bool(perms["laboratory_management"].get(action, False))
    if resource in CRUD_RESOURCES:
        # Без вкладки нет ни просмотра, ни мутаций каталога.
        if not perms["navigation"].get(resource, False):
            return False
        if action == "read":
            return True
        section = perms.get(resource)
        if not isinstance(section, dict):
            return False
        return bool(section.get(action, False))
    section = perms.get(resource)
    if not isinstance(section, dict):
        return False
    return bool(section.get(action, False))
