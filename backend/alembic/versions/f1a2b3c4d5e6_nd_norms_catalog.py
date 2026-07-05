"""nd_norms catalog

Revision ID: f1a2b3c4d5e6
Revises: d4bf3d4b6ae2
Create Date: 2026-06-26 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "f1a2b3c4d5e6"
down_revision = "d4bf3d4b6ae2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "nd_norms",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "name",
            sa.String(length=255),
            nullable=False,
            comment="Наименование нормы",
        ),
        sa.Column("laboratory_id", sa.Integer(), nullable=False),
        sa.Column("department_id", sa.Integer(), nullable=True),
        sa.Column(
            "method_data",
            sa.JSON(),
            nullable=False,
            comment="Тексты нормы по методам исследования: method_id и text",
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
        sa.ForeignKeyConstraint(
            ["department_id"],
            ["laborant.departments.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["laboratory_id"],
            ["laborant.laboratories.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        schema="laborant",
    )
    op.create_index(
        "idx_nd_norm_created_at",
        "nd_norms",
        ["created_at"],
        unique=False,
        schema="laborant",
    )
    op.create_index(
        "idx_nd_norm_name", "nd_norms", ["name"], unique=False, schema="laborant"
    )
    op.create_index(
        "idx_nd_norm_updated_at",
        "nd_norms",
        ["updated_at"],
        unique=False,
        schema="laborant",
    )
    op.create_index(
        op.f("ix_laborant_nd_norms_created_at"),
        "nd_norms",
        ["created_at"],
        unique=False,
        schema="laborant",
    )
    op.create_index(
        op.f("ix_laborant_nd_norms_created_by"),
        "nd_norms",
        ["created_by"],
        unique=False,
        schema="laborant",
    )
    op.create_index(
        op.f("ix_laborant_nd_norms_created_by_hash"),
        "nd_norms",
        ["created_by_hash"],
        unique=False,
        schema="laborant",
    )
    op.create_index(
        op.f("ix_laborant_nd_norms_deleted_at"),
        "nd_norms",
        ["deleted_at"],
        unique=False,
        schema="laborant",
    )
    op.create_index(
        op.f("ix_laborant_nd_norms_deleted_by"),
        "nd_norms",
        ["deleted_by"],
        unique=False,
        schema="laborant",
    )
    op.create_index(
        op.f("ix_laborant_nd_norms_deleted_by_hash"),
        "nd_norms",
        ["deleted_by_hash"],
        unique=False,
        schema="laborant",
    )
    op.create_index(
        op.f("ix_laborant_nd_norms_name"),
        "nd_norms",
        ["name"],
        unique=False,
        schema="laborant",
    )
    op.create_index(
        op.f("ix_laborant_nd_norms_updated_at"),
        "nd_norms",
        ["updated_at"],
        unique=False,
        schema="laborant",
    )
    op.create_index(
        op.f("ix_laborant_nd_norms_updated_by"),
        "nd_norms",
        ["updated_by"],
        unique=False,
        schema="laborant",
    )
    op.create_index(
        op.f("ix_laborant_nd_norms_updated_by_hash"),
        "nd_norms",
        ["updated_by_hash"],
        unique=False,
        schema="laborant",
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_laborant_nd_norms_updated_by_hash"),
        table_name="nd_norms",
        schema="laborant",
    )
    op.drop_index(
        op.f("ix_laborant_nd_norms_updated_by"),
        table_name="nd_norms",
        schema="laborant",
    )
    op.drop_index(
        op.f("ix_laborant_nd_norms_updated_at"),
        table_name="nd_norms",
        schema="laborant",
    )
    op.drop_index(
        op.f("ix_laborant_nd_norms_name"), table_name="nd_norms", schema="laborant"
    )
    op.drop_index(
        op.f("ix_laborant_nd_norms_deleted_by_hash"),
        table_name="nd_norms",
        schema="laborant",
    )
    op.drop_index(
        op.f("ix_laborant_nd_norms_deleted_by"),
        table_name="nd_norms",
        schema="laborant",
    )
    op.drop_index(
        op.f("ix_laborant_nd_norms_deleted_at"),
        table_name="nd_norms",
        schema="laborant",
    )
    op.drop_index(
        op.f("ix_laborant_nd_norms_created_by_hash"),
        table_name="nd_norms",
        schema="laborant",
    )
    op.drop_index(
        op.f("ix_laborant_nd_norms_created_by"),
        table_name="nd_norms",
        schema="laborant",
    )
    op.drop_index(
        op.f("ix_laborant_nd_norms_created_at"),
        table_name="nd_norms",
        schema="laborant",
    )
    op.drop_index("idx_nd_norm_updated_at", table_name="nd_norms", schema="laborant")
    op.drop_index("idx_nd_norm_name", table_name="nd_norms", schema="laborant")
    op.drop_index("idx_nd_norm_created_at", table_name="nd_norms", schema="laborant")
    op.drop_table("nd_norms", schema="laborant")
