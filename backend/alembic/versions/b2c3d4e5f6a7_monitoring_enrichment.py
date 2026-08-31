"""monitoring enrichment

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-28 17:15:00.000000

"""
import sqlalchemy as sa
from alembic import op
from core.config import get_database_schema

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None

SCHEMA = get_database_schema()


def upgrade() -> None:
    op.add_column(
        "monitoring_errors",
        sa.Column("reporter_name", sa.String(length=255), nullable=True, comment="ФИО при репорте с клиента"),
        schema=SCHEMA,
    )
    op.add_column(
        "monitoring_errors",
        sa.Column("reporter_hash", sa.String(length=32), nullable=True, comment="hsnils при репорте с клиента"),
        schema=SCHEMA,
    )
    op.add_column(
        "monitoring_errors",
        sa.Column("user_agent", sa.String(length=500), nullable=True, comment="User-Agent браузера"),
        schema=SCHEMA,
    )
    op.add_column(
        "monitoring_errors",
        sa.Column("app_version", sa.String(length=40), nullable=True, comment="Версия приложения при ошибке"),
        schema=SCHEMA,
    )
    op.add_column(
        "monitoring_errors",
        sa.Column("resolved_by_name", sa.String(length=255), nullable=True, comment="ФИО закрывшего ошибку"),
        schema=SCHEMA,
    )
    op.add_column(
        "monitoring_errors",
        sa.Column("resolved_by_hash", sa.String(length=32), nullable=True, comment="hsnils закрывшего ошибку"),
        schema=SCHEMA,
    )
    op.add_column(
        "monitoring_errors",
        sa.Column("resolve_comment", sa.String(length=500), nullable=True, comment="Комментарий при закрытии"),
        schema=SCHEMA,
    )
    op.add_column(
        "user_presence",
        sa.Column("current_path", sa.String(length=500), nullable=True, comment="Текущий путь клиента"),
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_column("user_presence", "current_path", schema=SCHEMA)
    op.drop_column("monitoring_errors", "resolve_comment", schema=SCHEMA)
    op.drop_column("monitoring_errors", "resolved_by_hash", schema=SCHEMA)
    op.drop_column("monitoring_errors", "resolved_by_name", schema=SCHEMA)
    op.drop_column("monitoring_errors", "app_version", schema=SCHEMA)
    op.drop_column("monitoring_errors", "user_agent", schema=SCHEMA)
    op.drop_column("monitoring_errors", "reporter_hash", schema=SCHEMA)
    op.drop_column("monitoring_errors", "reporter_name", schema=SCHEMA)
