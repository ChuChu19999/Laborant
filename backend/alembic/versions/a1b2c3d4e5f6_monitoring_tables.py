"""monitoring tables

Revision ID: a1b2c3d4e5f6
Revises: 04bce01fbe1c
Create Date: 2026-08-28 15:30:00.000000

"""
import sqlalchemy as sa
from alembic import op
from core.config import get_database_schema

revision = "a1b2c3d4e5f6"
down_revision = "04bce01fbe1c"
branch_labels = None
depends_on = None

SCHEMA = get_database_schema()


def upgrade() -> None:
    op.create_table(
        "monitoring_errors",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("fingerprint", sa.String(length=64), nullable=False, comment="SHA-256 fingerprint уникальной ошибки"),
        sa.Column("severity", sa.String(length=20), nullable=False, comment="Уровень: warning, error, critical"),
        sa.Column("source", sa.String(length=20), nullable=False, comment="Источник: backend, frontend"),
        sa.Column("message", sa.String(length=500), nullable=False, comment="Укороченный текст ошибки"),
        sa.Column("summary", sa.String(length=280), nullable=False, comment="Краткое описание для списка"),
        sa.Column("stack_trace", sa.Text(), nullable=True, comment="Укороченный стек"),
        sa.Column("path", sa.String(length=500), nullable=True, comment="Нормализованный путь или URL"),
        sa.Column("exception_type", sa.String(length=120), nullable=True, comment="Тип исключения на бэкенде"),
        sa.Column("occurrence_count", sa.Integer(), nullable=False, server_default="1", comment="Число повторов"),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True, comment="Время закрытия ошибки"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("created_by_hash", sa.String(length=32), nullable=True),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("updated_by_hash", sa.String(length=32), nullable=True),
        sa.Column("deleted_by", sa.String(length=255), nullable=True),
        sa.Column("deleted_by_hash", sa.String(length=32), nullable=True),
        sa.CheckConstraint(
            "severity IN ('warning', 'error', 'critical')",
            name="ck_monitoring_errors_severity",
        ),
        sa.CheckConstraint(
            "source IN ('backend', 'frontend')",
            name="ck_monitoring_errors_source",
        ),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )
    op.create_index(
        "unique_monitoring_error_fingerprint",
        "monitoring_errors",
        ["fingerprint"],
        unique=True,
        schema=SCHEMA,
    )

    op.create_table(
        "user_presence",
        sa.Column("hsnils", sa.String(length=64), nullable=False, comment="hsnils пользователя"),
        sa.Column("full_name", sa.String(length=255), nullable=False, server_default="", comment="ФИО пользователя"),
        sa.Column(
            "presence_category",
            sa.String(length=20),
            nullable=False,
            comment="Категория по приоритету: laborant, engineer, admin",
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Время последнего heartbeat",
        ),
        sa.CheckConstraint(
            "presence_category IN ('laborant', 'engineer', 'admin')",
            name="ck_user_presence_category",
        ),
        sa.PrimaryKeyConstraint("hsnils"),
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_table("user_presence", schema=SCHEMA)
    op.drop_index("unique_monitoring_error_fingerprint", table_name="monitoring_errors", schema=SCHEMA)
    op.drop_table("monitoring_errors", schema=SCHEMA)
