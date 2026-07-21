"""drop accreditation_header_row from protocol_templates

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-07-17 15:20:00.000000

"""

from __future__ import annotations
import sqlalchemy as sa
from alembic import op

revision = "f2a3b4c5d6e7"
down_revision = "e1f2a3b4c5d6"
branch_labels = None
depends_on = None

SCHEMA = "laborant"


def upgrade() -> None:
    op.drop_column("protocol_templates", "accreditation_header_row", schema=SCHEMA)


def downgrade() -> None:
    op.add_column(
        "protocol_templates",
        sa.Column(
            "accreditation_header_row",
            sa.Integer(),
            nullable=True,
            comment="Строка шапки аккредитации",
        ),
        schema=SCHEMA,
    )
