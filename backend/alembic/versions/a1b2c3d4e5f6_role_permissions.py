"""add permissions column to roles

Revision ID: a1b2c3d4e5f6
Revises: f2a3b4c5d6e7
Create Date: 2026-07-28 09:45:00.000000

"""

from __future__ import annotations
from alembic import op

revision = "a1b2c3d4e5f6"
down_revision = "f2a3b4c5d6e7"
branch_labels = None
depends_on = None

SCHEMA = "laborant"

DEFAULT_PERMISSIONS_SQL = """
ALTER TABLE laborant.roles
ADD COLUMN permissions JSON NOT NULL
DEFAULT $perm${
  "navigation": {
    "home": true,
    "samples": false,
    "protocols": false,
    "equipment": false,
    "sampling_locations": false,
    "nd_norms": false,
    "test_objects": false
  },
  "laboratory_management": {"access": false},
  "samples": {
    "visible_fields": [],
    "update": false,
    "delete": false
  },
  "protocols": {"read": false, "create": false, "update": false, "delete": false},
  "equipment": {"read": false, "create": false, "update": false, "delete": false},
  "sampling_locations": {"read": false, "create": false, "update": false, "delete": false},
  "nd_norms": {"read": false, "create": false, "update": false, "delete": false},
  "test_objects": {"read": false, "create": false, "update": false, "delete": false},
  "calculations": {"execute": false, "create": false, "update": false, "delete": false, "show_equipment": false},
  "sampling_terminology": "well_mode"
}$perm$::json
"""


def upgrade() -> None:
    op.execute(DEFAULT_PERMISSIONS_SQL)
    op.execute(
        f"COMMENT ON COLUMN {SCHEMA}.roles.permissions IS 'Матрица прав доступа роли'"
    )
    op.execute(f"ALTER TABLE {SCHEMA}.roles ALTER COLUMN permissions DROP DEFAULT")


def downgrade() -> None:
    op.execute(f"ALTER TABLE {SCHEMA}.roles DROP COLUMN permissions")
