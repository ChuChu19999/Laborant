from __future__ import annotations
from self_check import api, core, models, repositories, schemas, services, utils

_LAYER_COLLECTORS = (
    ("api", api.collect_errors),
    ("core", core.collect_errors),
    ("models", models.collect_errors),
    ("repositories", repositories.collect_errors),
    ("schemas", schemas.collect_errors),
    ("services", services.collect_errors),
    ("utils", utils.collect_errors),
)


def collect_all_self_check_errors() -> list[str]:
    """Собрать нарушения self-check по всем слоям."""
    errors: list[str] = []
    for _name, collect in _LAYER_COLLECTORS:
        errors.extend(collect())
    return errors


def collect_self_check_errors_by_layer() -> dict[str, list[str]]:
    """Собрать нарушения, сгруппированные по слою."""
    return {name: collect() for name, collect in _LAYER_COLLECTORS}


def assert_all_self_checks() -> None:
    """Упасть при любом нарушении self-check."""
    by_layer = collect_self_check_errors_by_layer()
    errors = [item for items in by_layer.values() for item in items]
    if not errors:
        return
    parts: list[str] = []
    for name, items in by_layer.items():
        if not items:
            continue
        parts.append(f"{name}: {len(items)}")
        parts.extend(f"  - {item}" for item in items)
    raise RuntimeError(f"Self-check failed ({len(errors)}):\n" + "\n".join(parts))
