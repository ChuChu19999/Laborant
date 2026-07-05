"""roles catalog

Revision ID: e8ebdbadb7b7
Revises: a8f3c1d92e40
Create Date: 2026-06-25 10:23:39.373407

"""

import sqlalchemy as sa
from alembic import op

revision = "e8ebdbadb7b7"
down_revision = "a8f3c1d92e40"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "name",
            sa.String(length=255),
            nullable=False,
            comment="Наименование роли",
        ),
        sa.Column(
            "visibility_scope",
            sa.JSON(),
            nullable=False,
            comment="Область видимости: laboratory_ids, department_ids",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("created_by_hash", sa.String(length=32), nullable=True),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("updated_by_hash", sa.String(length=32), nullable=True),
        sa.Column("deleted_by", sa.String(length=255), nullable=True),
        sa.Column("deleted_by_hash", sa.String(length=32), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        schema="laborant",
    )
    op.create_index(
        "unique_role_name",
        "roles",
        ["name"],
        unique=True,
        schema="laborant",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_role_created_at",
        "roles",
        ["created_at"],
        unique=False,
        schema="laborant",
    )
    op.create_index(
        "idx_role_updated_at",
        "roles",
        ["updated_at"],
        unique=False,
        schema="laborant",
    )
    op.create_index(
        op.f("ix_laborant_roles_name"),
        "roles",
        ["name"],
        unique=False,
        schema="laborant",
    )
    op.create_index(
        op.f("ix_laborant_roles_deleted_at"),
        "roles",
        ["deleted_at"],
        unique=False,
        schema="laborant",
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_laborant_roles_deleted_at"),
        table_name="roles",
        schema="laborant",
    )
    op.drop_index(
        op.f("ix_laborant_roles_name"),
        table_name="roles",
        schema="laborant",
    )
    op.drop_index("idx_role_updated_at", table_name="roles", schema="laborant")
    op.drop_index("idx_role_created_at", table_name="roles", schema="laborant")
    op.drop_index(
        "unique_role_name",
        table_name="roles",
        schema="laborant",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_table("roles", schema="laborant")
