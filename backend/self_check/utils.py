from __future__ import annotations
import re
from self_check._common import PatternSpec, scan_layer_patterns

_PATTERNS: tuple[PatternSpec, ...] = (
    (
        re.compile(r"\bdb\.commit\s*\("),
        "db.commit() запрещён в utils",
    ),
    (
        re.compile(r"\bsession\.commit\s*\("),
        "session.commit() запрещён в utils",
    ),
    (
        re.compile(r"\bHTTPException\b"),
        "HTTPException запрещён в utils",
    ),
    (
        re.compile(r"^\s*(?:from\s+fastapi\b|import\s+fastapi\b)", re.MULTILINE),
        "fastapi запрещён в utils",
    ),
    (
        re.compile(r"^\s*(?:from\s+httpx\b|import\s+httpx\b)", re.MULTILINE),
        "httpx запрещён в utils",
    ),
    (
        re.compile(r"^\s*(?:from\s+services\b|import\s+services\b)", re.MULTILINE),
        "utils не импортирует services",
    ),
    (
        re.compile(r"^\s*(?:from\s+api\b|import\s+api\b)", re.MULTILINE),
        "utils не импортирует api",
    ),
    (
        re.compile(r"^\s*(?:from\s+repositories\b|import\s+repositories\b)", re.MULTILINE),
        "utils не импортирует repositories",
    ),
    (
        re.compile(r"^\s*(?:from\s+core\.(?!logger\b)|import\s+core\.(?!logger\b))", re.MULTILINE),
        "utils не импортирует core (кроме core.logger)",
    ),
    (
        re.compile(r"^\s*from\s+core\s+import\b", re.MULTILINE),
        "utils не импортирует пакет core целиком",
    ),
    (
        re.compile(r"\braise\s+(?:NotFoundError|DomainValidationError|ConflictError)\b"),
        "доменные исключения запрещены в utils",
    ),
    (
        re.compile(r"\b(?:db|session)\.query\s*\("),
        "legacy Query API запрещён в utils",
    ),
)


def collect_errors() -> list[str]:
    """Собрать нарушения self-check для utils."""
    return scan_layer_patterns("utils", _PATTERNS, tag="utils")
