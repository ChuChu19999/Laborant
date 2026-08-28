from __future__ import annotations
import re
from self_check._common import PatternSpec, scan_layer_file_patterns

_PATTERNS: tuple[PatternSpec, ...] = (
    (
        re.compile(r"\bcreate_engine\s*\("),
        "синхронный create_engine запрещён — только create_async_engine",
    ),
    (
        re.compile(r"\bsessionmaker\s*\("),
        "синхронный sessionmaker запрещён — только async_sessionmaker",
    ),
    (
        re.compile(r"^\s*from\s+sqlalchemy\.orm\s+import\b[^\n#]*\bSession\b", re.MULTILINE),
        "sqlalchemy.orm.Session запрещён — только AsyncSession",
    ),
    (
        re.compile(r"^\s*from\s+sqlalchemy\s+import\b[^\n#]*\bSession\b", re.MULTILINE),
        "sqlalchemy.Session запрещён — только AsyncSession",
    ),
)


def collect_layer_errors(layer: str) -> list[str]:
    """Запретить синхронный SQLAlchemy в одном слое (core, models, repositories)."""
    return scan_layer_file_patterns(layer, _PATTERNS, tag=layer)
