"""samples sample_type nullable

Revision ID: d5e6f7a8b9c0
Revises: c4f5a6b7d8e9
Create Date: 2026-07-08 09:20:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "d5e6f7a8b9c0"
down_revision = "c4f5a6b7d8e9"
branch_labels = None
depends_on = None

SCHEMA = "laborant"


def upgrade() -> None:
    op.alter_column(
        "samples",
        "sample_type",
        existing_type=sa.String(length=50),
        nullable=True,
        existing_comment="Тип пробы",
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.alter_column(
        "samples",
        "sample_type",
        existing_type=sa.String(length=50),
        nullable=False,
        existing_comment="Тип пробы",
        schema=SCHEMA,
    )
