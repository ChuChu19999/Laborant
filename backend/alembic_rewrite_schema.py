from __future__ import annotations
from pathlib import Path
import re
import sys
from core.config import get_database_schema


def rewrite_revision(path: Path) -> None:
    """Заменить захардкоженную схему на переменную SCHEMA."""
    schema = get_database_schema()
    text = path.read_text(encoding="utf-8")
    text = text.replace(f"schema={schema!r}", "schema=SCHEMA")
    text = text.replace(f"source_schema={schema!r}", "source_schema=SCHEMA")
    text = text.replace(f"referent_schema={schema!r}", "referent_schema=SCHEMA")
    text = re.sub(
        rf"'{re.escape(schema)}\.([A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*)'",
        r"f'{SCHEMA}.\1'",
        text,
    )
    path.write_text(text, encoding="utf-8")


def main() -> None:
    """Переписать схему в указанном файле revision."""
    if len(sys.argv) < 2:
        raise SystemExit("usage: python -m alembic_rewrite_schema <revision_file>")
    rewrite_revision(Path(sys.argv[1]))


if __name__ == "__main__":
    main()
