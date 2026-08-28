from __future__ import annotations
import re
from self_check import repositories_nested_sample_load, sync_sqlalchemy
from self_check._common import ROOT, PatternSpec, is_match_commented, iter_py_files, line_no, scan_layer_patterns

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
        re.compile(r"\bHTTPException\b"),
        "HTTPException запрещён в repositories",
    ),
    (
        re.compile(r"^\s*(?:from\s+fastapi\b|import\s+fastapi\b)", re.MULTILINE),
        "fastapi запрещён в repositories",
    ),
    (
        re.compile(r"^\s*(?:from\s+httpx\b|import\s+httpx\b)", re.MULTILINE),
        "httpx запрещён в repositories",
    ),
    (
        re.compile(r"^\s*(?:from\s+api\b|import\s+api\b)", re.MULTILINE),
        "repositories не импортирует api",
    ),
    (
        re.compile(r"^\s*(?:from\s+services\b|import\s+services\b)", re.MULTILINE),
        "repositories не импортирует services",
    ),
    (
        re.compile(r"^\s*(?:from\s+schemas\b|import\s+schemas\b)", re.MULTILINE),
        "repositories не импортирует schemas",
    ),
    (
        re.compile(r"^\s*(?:from\s+core\.deps\b|import\s+core\.deps\b)", re.MULTILINE),
        "repositories не импортирует core.deps",
    ),
    (
        re.compile(r"\braise\s+NotFoundError\b"),
        "NotFoundError запрещён в repository — только service",
    ),
    (
        re.compile(r"\braise\s+DomainValidationError\b"),
        "DomainValidationError запрещён в repository — только service",
    ),
    (
        re.compile(r"\braise\s+ConflictError\b"),
        "ConflictError запрещён в repository — только service",
    ),
    (
        re.compile(r"\b(?:db|session)\.query\s*\("),
        "legacy Query API запрещён — только select()",
    ),
)

_OTHER_REPO_IMPORT = re.compile(
    r"^\s*(?:from\s+repositories\.(?!base\b)([\w.]+)|import\s+repositories\.(?!base\b)([\w.]+))",
    re.MULTILINE,
)


def _scan_repo_independence() -> list[str]:
    """Запретить импорт чужих repositories.* (кроме repositories.base)."""
    errors: list[str] = []
    for path in iter_py_files("repositories"):
        if path.name == "base.py":
            continue
        text = path.read_text(encoding="utf-8")
        rel = path.relative_to(ROOT).as_posix()
        for match in _OTHER_REPO_IMPORT.finditer(text):
            if is_match_commented(text, match.start()):
                continue
            target = match.group(1) or match.group(2) or "?"
            errors.append(
                f"[repositories] {rel}:{line_no(text, match.start())}: "
                f"repositories независимы — не импортировать repositories.{target} "
                "(только repositories.base)"
            )
    return errors


def collect_errors() -> list[str]:
    """Собрать нарушения self-check для repositories."""
    errors = scan_layer_patterns("repositories", _PATTERNS, tag="repositories")
    errors.extend(_scan_repo_independence())
    errors.extend(sync_sqlalchemy.collect_layer_errors("repositories"))
    errors.extend(repositories_nested_sample_load.collect_errors())
    return errors
