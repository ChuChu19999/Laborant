"""nd_norms test_object

Revision ID: a7b8c9d0e1f2
Revises: f1a2b3c4d5e6
Create Date: 2026-06-26 14:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "a7b8c9d0e1f2"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "nd_norms",
        sa.Column(
            "test_object",
            sa.String(length=255),
            nullable=False,
            server_default="",
            comment="Объект испытаний",
        ),
        schema="laborant",
    )
    op.alter_column(
        "nd_norms",
        "test_object",
        server_default=None,
        schema="laborant",
    )
    op.create_index(
        "idx_nd_norm_test_object",
        "nd_norms",
        ["test_object"],
        unique=False,
        schema="laborant",
    )
    op.create_index(
        op.f("ix_laborant_nd_norms_test_object"),
        "nd_norms",
        ["test_object"],
        unique=False,
        schema="laborant",
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_laborant_nd_norms_test_object"),
        table_name="nd_norms",
        schema="laborant",
    )
    op.drop_index("idx_nd_norm_test_object", table_name="nd_norms", schema="laborant")
    op.drop_column("nd_norms", "test_object", schema="laborant")
