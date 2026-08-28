from __future__ import annotations
import re
from self_check import sync_sqlalchemy
from self_check._common import ROOT, PatternSpec, is_match_commented, iter_py_files, line_no, scan_layer_file_patterns

# deps.py — единственное исключение: services + schemas для Depends-цепочек
_DEPS_ALLOW = frozenset({"core/deps.py"})
_COMMIT_ALLOW = frozenset({"core/database.py"})

_FORBIDDEN_IMPORTS: tuple[PatternSpec, ...] = (
    (
        re.compile(r"^\s*(?:from\s+api\b|import\s+api\b)", re.MULTILINE),
        "core не импортирует api",
    ),
    (
        re.compile(r"^\s*(?:from\s+services\b|import\s+services\b)", re.MULTILINE),
        "core не импортирует services (кроме core/deps.py)",
    ),
    (
        re.compile(r"^\s*(?:from\s+repositories\b|import\s+repositories\b)", re.MULTILINE),
        "core не импортирует repositories",
    ),
    (
        re.compile(r"^\s*(?:from\s+schemas\b|import\s+schemas\b)", re.MULTILINE),
        "core не импортирует schemas (кроме core/deps.py)",
    ),
)

_COMMIT_PATTERNS: tuple[PatternSpec, ...] = (
    (
        re.compile(r"\b(?:db|session)\.commit\s*\("),
        "commit вне get_db запрещён (разрешён только core/database.py)",
    ),
)


def collect_errors() -> list[str]:
    """Собрать нарушения self-check для core."""
    errors: list[str] = []
    errors.extend(scan_layer_file_patterns("core", _FORBIDDEN_IMPORTS, tag="core", allow_rel_paths=_DEPS_ALLOW))
    errors.extend(scan_layer_file_patterns("core", _COMMIT_PATTERNS, tag="core", allow_rel_paths=_COMMIT_ALLOW))
    # В database.py commit допустим, но только внутри get_db — проверяем наличие функции.
    database_path = ROOT / "core" / "database.py"
    if database_path.is_file():
        text = database_path.read_text(encoding="utf-8")
        if "async def get_db" not in text:
            errors.append("[core] core/database.py: отсутствует async def get_db")
        if not re.search(r"await\s+session\.commit\s*\(", text):
            errors.append("[core] core/database.py: get_db должен вызывать session.commit()")
    else:
        errors.append("[core] core/database.py не найден")

    # Запрет httpx вне клиентов (разрешены *client*.py)
    httpx_re = re.compile(r"^\s*(?:from\s+httpx\b|import\s+httpx\b)", re.MULTILINE)
    for path in iter_py_files("core"):
        rel = path.relative_to(ROOT).as_posix()
        if "client" in path.name.lower():
            continue
        text = path.read_text(encoding="utf-8")
        for match in httpx_re.finditer(text):
            if is_match_commented(text, match.start()):
                continue
            errors.append(f"[core] {rel}:{line_no(text, match.start())}: httpx только в core/*client*")
    errors.extend(sync_sqlalchemy.collect_layer_errors("core"))
    return errors
