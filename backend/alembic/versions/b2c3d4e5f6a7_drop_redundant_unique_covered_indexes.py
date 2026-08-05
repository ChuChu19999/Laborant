"""drop redundant non-unique indexes covered by unique indexes

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-04 16:15:00.000000

"""

from __future__ import annotations
from alembic import op

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None

SCHEMA = "laborant"

INDEXES_TO_DROP = (
    ("idx_laboratory_name", "laboratories"),
    ("idx_department_laboratory_name", "departments"),
    ("idx_sampling_location_branch_name", "sampling_locations"),
    ("idx_well_mode_branch_name", "well_modes"),
)


def upgrade() -> None:
    for index_name, table_name in INDEXES_TO_DROP:
        op.drop_index(index_name, table_name=table_name, schema=SCHEMA)


def downgrade() -> None:
    op.create_index(
        "idx_laboratory_name",
        "laboratories",
        ["name"],
        schema=SCHEMA,
    )
    op.create_index(
        "idx_department_laboratory_name",
        "departments",
        ["laboratory_id", "name"],
        schema=SCHEMA,
    )
    op.create_index(
        "idx_sampling_location_branch_name",
        "sampling_locations",
        ["branch_id", "name"],
        schema=SCHEMA,
    )
    op.create_index(
        "idx_well_mode_branch_name",
        "well_modes",
        ["branch_id", "name"],
        schema=SCHEMA,
    )
