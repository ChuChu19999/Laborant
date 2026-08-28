from __future__ import annotations
import re
from self_check import services_update_flush
from self_check._common import PatternSpec, scan_layer_patterns

_PATTERNS: tuple[PatternSpec, ...] = (
    (
        re.compile(r"\bdb\.commit\s*\("),
        "db.commit() запрещён — только get_db; service — flush",
    ),
    (
        re.compile(r"\bsession\.commit\s*\("),
        "session.commit() запрещён — только get_db",
    ),
    (
        re.compile(r"\bHTTPException\b"),
        "HTTPException запрещён в services — core.exceptions + handlers",
    ),
    (
        re.compile(r"^\s*(?:from\s+fastapi\b|import\s+fastapi\b)", re.MULTILINE),
        "fastapi запрещён в services",
    ),
    (
        re.compile(r"^\s*(?:from\s+httpx\b|import\s+httpx\b)", re.MULTILINE),
        "httpx запрещён — только core/*_client",
    ),
    (
        re.compile(r"^\s*(?:from\s+api\b|import\s+api\b)", re.MULTILINE),
        "services не импортирует api",
    ),
    (
        re.compile(r"^\s*(?:from\s+core\.deps\b|import\s+core\.deps\b)", re.MULTILINE),
        "services не импортирует core.deps",
    ),
    (
        re.compile(r"^\s*(?:from\s+core\.responses\b|import\s+core\.responses\b)", re.MULTILINE),
        "services не импортирует core.responses",
    ),
    (
        re.compile(r"\b(?:db|session)\.query\s*\("),
        "legacy Query API запрещён — только repository + select()",
    ),
)


def collect_errors() -> list[str]:
    """Собрать нарушения self-check для services."""
    errors = scan_layer_patterns("services", _PATTERNS, tag="services")
    errors.extend(services_update_flush.collect_errors())
    return errors
