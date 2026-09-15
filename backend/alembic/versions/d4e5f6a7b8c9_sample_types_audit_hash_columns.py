"""add audit hash columns to sample_types and test_purposes

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-09 16:10:00.000000

"""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op
from core.config import get_database_schema

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None

SCHEMA = get_database_schema()

AUDIT_HASH_COLUMNS = (
    ("created_by_hash", sa.String(length=32)),
    ("updated_by_hash", sa.String(length=32)),
    ("deleted_by_hash", sa.String(length=32)),
)

AUDIT_BY_COLUMNS = ("created_by", "updated_by", "deleted_by")


def _table_column_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns(table_name, schema=SCHEMA)}


def upgrade() -> None:
    for table_name in ("sample_types", "test_purposes"):
        existing = _table_column_names(table_name)
        for column_name, column_type in AUDIT_HASH_COLUMNS:
            if column_name in existing:
                continue
            op.add_column(
                table_name,
                sa.Column(column_name, column_type, nullable=True),
                schema=SCHEMA,
            )
        for column_name in AUDIT_BY_COLUMNS:
            if column_name not in existing:
                continue
            op.alter_column(
                table_name,
                column_name,
                existing_type=sa.String(length=150),
                type_=sa.String(length=255),
                existing_nullable=True,
                schema=SCHEMA,
            )


def downgrade() -> None:
    for table_name in ("sample_types", "test_purposes"):
        existing = _table_column_names(table_name)
        for column_name in AUDIT_BY_COLUMNS:
            if column_name not in existing:
                continue
            op.alter_column(
                table_name,
                column_name,
                existing_type=sa.String(length=255),
                type_=sa.String(length=150),
                existing_nullable=True,
                schema=SCHEMA,
            )
        for column_name, _column_type in reversed(AUDIT_HASH_COLUMNS):
            if column_name not in existing:
                continue
            op.drop_column(table_name, column_name, schema=SCHEMA)
