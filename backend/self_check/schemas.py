from __future__ import annotations
import re
from self_check._common import PatternSpec, scan_layer_patterns
from self_check.schemas_runtime import collect_optional_constraint_errors

_PATTERNS: tuple[PatternSpec, ...] = (
    (
        re.compile(r"Annotated\[\s*OptionalNonEmptyStr\s*,\s*Field\([^)]*max_length"),
        "Annotated[OptionalNonEmptyStr, Field(max_length=...)] — max_length через Field(..., max_length=N) на поле",
    ),
    (
        re.compile(r"Annotated\[\s*str\s*\|\s*None\s*,\s*Field\([^)]*max_length"),
        "Annotated[str | None, Field(max_length=...)] — max_length через Field(..., max_length=N) на поле",
    ),
    (
        re.compile(r"^\s*class\s+Config\s*:", re.MULTILINE),
        "Pydantic V1 class Config запрещён — ConfigDict",
    ),
    (
        re.compile(r"@validator\s*\("),
        "Pydantic V1 @validator запрещён — field_validator / AfterValidator",
    ),
    (
        re.compile(r"@root_validator\s*\("),
        "Pydantic V1 @root_validator запрещён — model_validator",
    ),
    (
        re.compile(r"\borm_mode\s*="),
        "orm_mode запрещён — from_attributes=True",
    ),
    (
        re.compile(r"\bHTTPException\b"),
        "HTTPException запрещён в schemas",
    ),
    (
        re.compile(r"^\s*(?:from\s+fastapi\b|import\s+fastapi\b)", re.MULTILINE),
        "fastapi запрещён в schemas",
    ),
    (
        re.compile(r"^\s*(?:from\s+httpx\b|import\s+httpx\b)", re.MULTILINE),
        "httpx запрещён в schemas",
    ),
    (
        re.compile(r"^\s*(?:from\s+services\b|import\s+services\b)", re.MULTILINE),
        "schemas не импортирует services",
    ),
    (
        re.compile(r"^\s*(?:from\s+repositories\b|import\s+repositories\b)", re.MULTILINE),
        "schemas не импортирует repositories",
    ),
    (
        re.compile(r"^\s*(?:from\s+api\b|import\s+api\b)", re.MULTILINE),
        "schemas не импортирует api",
    ),
    (
        re.compile(r"^\s*(?:from\s+core\.deps\b|import\s+core\.deps\b)", re.MULTILINE),
        "schemas не импортирует core.deps",
    ),
    (
        re.compile(r"\braise\s+(?:NotFoundError|DomainValidationError|ConflictError)\b"),
        "доменные исключения запрещены в schemas",
    ),
    (
        re.compile(r"\bdb\.commit\s*\("),
        "db.commit() запрещён в schemas",
    ),
)


def collect_errors() -> list[str]:
    """Собрать нарушения self-check для schemas (static + runtime)."""
    errors = scan_layer_patterns("schemas", _PATTERNS, tag="schemas")
    for item in collect_optional_constraint_errors():
        errors.append(f"[schemas] {item}")
    return errors
