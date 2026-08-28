from __future__ import annotations
import ast
import re
from self_check import sync_sqlalchemy
from self_check._common import ROOT, PatternSpec, is_match_commented, iter_py_files, line_no, scan_layer_patterns

_PATTERNS: tuple[PatternSpec, ...] = (
    (
        re.compile(r"""Mapped\[\s*["'][^"']+["']\s*\|\s*None\s*\]"""),
        'Mapped["Model" | None] запрещён — писать Mapped["Model | None"]',
    ),
    (
        re.compile(r"__allow_unmapped__\s*="),
        "__allow_unmapped__ запрещён (поля ответа не на ORM)",
    ),
    (
        re.compile(r"postgresql\.ENUM\b"),
        "PostgreSQL ENUM запрещён — Python Enum + String (+ CHECK)",
    ),
    (
        re.compile(r"\bHTTPException\b"),
        "HTTPException запрещён в models",
    ),
    (
        re.compile(r"^\s*(?:from\s+fastapi\b|import\s+fastapi\b)", re.MULTILINE),
        "fastapi запрещён в models",
    ),
    (
        re.compile(r"^\s*(?:from\s+httpx\b|import\s+httpx\b)", re.MULTILINE),
        "httpx запрещён в models",
    ),
    (
        re.compile(r"^\s*(?:from\s+schemas\b|import\s+schemas\b)", re.MULTILINE),
        "models не импортирует schemas",
    ),
    (
        re.compile(r"^\s*(?:from\s+services\b|import\s+services\b)", re.MULTILINE),
        "models не импортирует services",
    ),
    (
        re.compile(r"^\s*(?:from\s+repositories\b|import\s+repositories\b)", re.MULTILINE),
        "models не импортирует repositories",
    ),
    (
        re.compile(r"^\s*(?:from\s+api\b|import\s+api\b)", re.MULTILINE),
        "models не импортирует api",
    ),
    (
        re.compile(r"\braise\s+(?:NotFoundError|DomainValidationError|ConflictError)\b"),
        "доменные исключения запрещены в models",
    ),
)


def _scan_property_enrichment() -> list[str]:
    """Запретить @property *_name / *_count на ORM-моделях."""
    errors: list[str] = []
    for path in iter_py_files("models"):
        rel = path.relative_to(ROOT).as_posix()
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except SyntaxError as exc:
            errors.append(f"[models] {rel}: syntax error: {exc}")
            continue
        for node in ast.walk(tree):
            if not isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
                continue
            if not node.name.endswith(("_name", "_count")):
                continue
            is_property = any(
                (isinstance(dec, ast.Name) and dec.id == "property")
                or (isinstance(dec, ast.Attribute) and dec.attr == "property")
                for dec in node.decorator_list
            )
            if not is_property:
                continue
            errors.append(
                f"[models] {rel}:{node.lineno}: @property {node.name} запрещён — "
                "@computed_field в schemas / build_*_response в service"
            )
    return errors


def _scan_sa_enum_columns() -> list[str]:
    """Запретить mapped_column(Enum(...)) / Column(Enum(...))."""
    errors: list[str] = []
    enum_call = re.compile(r"(?:mapped_column|Column)\s*\(\s*Enum\s*\(")
    for path in iter_py_files("models"):
        text = path.read_text(encoding="utf-8")
        rel = path.relative_to(ROOT).as_posix()
        for match in enum_call.finditer(text):
            if is_match_commented(text, match.start()):
                continue
            errors.append(
                f"[models] {rel}:{line_no(text, match.start())}: "
                "mapped_column(Enum(...)) запрещён — String + Python Enum"
            )
    return errors


def collect_errors() -> list[str]:
    """Собрать нарушения self-check для models."""
    errors = scan_layer_patterns("models", _PATTERNS, tag="models")
    errors.extend(_scan_property_enrichment())
    errors.extend(_scan_sa_enum_columns())
    errors.extend(sync_sqlalchemy.collect_layer_errors("models"))
    return errors
