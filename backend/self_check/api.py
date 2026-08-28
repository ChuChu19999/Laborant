from __future__ import annotations
import re
from self_check import api_background_tasks, api_path_params, api_route_duplicates, api_route_order
from self_check._common import PatternSpec, scan_layer_patterns

_PATTERNS: tuple[PatternSpec, ...] = (
    (
        re.compile(r"\bdb\.commit\s*\("),
        "db.commit() запрещён — только get_db",
    ),
    (
        re.compile(r"\bsession\.commit\s*\("),
        "session.commit() запрещён — только get_db",
    ),
    (
        re.compile(r"\b(?:db|session)\.refresh\s*\("),
        "db.refresh() в api запрещён — ORM lifecycle только в repository/service",
    ),
    (
        re.compile(r"^\s*(?:from\s+httpx\b|import\s+httpx\b)", re.MULTILINE),
        "httpx запрещён — только core/*_client",
    ),
    (
        re.compile(r"^\s*(?:from\s+repositories\b|import\s+repositories\b)", re.MULTILINE),
        "api не импортирует repositories",
    ),
    (
        re.compile(r"^\s*from\s+models\b", re.MULTILINE),
        "api не импортирует models",
    ),
    (
        re.compile(r"^\s*(?:from\s+utils\b|import\s+utils\b)", re.MULTILINE),
        "api не импортирует utils (повторяющийся query-парсинг — core.deps)",
    ),
    (
        re.compile(r"\b(?:db|session)\.query\s*\("),
        "legacy Query API запрещён — только select() в repository",
    ),
    (
        re.compile(r"\braise\s+NotFoundError\b"),
        "NotFoundError в api запрещён — только service",
    ),
)


def collect_errors() -> list[str]:
    """Собрать нарушения self-check для api."""
    errors = scan_layer_patterns("api", _PATTERNS, tag="api")
    errors.extend(api_route_order.collect_errors())
    errors.extend(api_route_duplicates.collect_errors())
    errors.extend(api_path_params.collect_errors())
    errors.extend(api_background_tasks.collect_errors())
    return errors
