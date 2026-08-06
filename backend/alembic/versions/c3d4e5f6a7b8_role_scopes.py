"""migrate roles to per-lab/department scopes

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-08-06 09:15:00.000000

"""

from __future__ import annotations
import json
from sqlalchemy import text
from alembic import op

revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None

SCHEMA = "laborant"


def upgrade() -> None:
    op.execute(f"""
        ALTER TABLE {SCHEMA}.roles
        ADD COLUMN scopes JSON NOT NULL DEFAULT '[]'::json
        """)
    op.execute(
        f"COMMENT ON COLUMN {SCHEMA}.roles.scopes IS "
        f"'Привязки: laboratory_id, department_id, permissions'"
    )

    connection = op.get_bind()
    dept_rows = connection.execute(text(f"""
            SELECT id, laboratory_id
            FROM {SCHEMA}.departments
            """)).fetchall()
    department_lab_map = {int(row[0]): int(row[1]) for row in dept_rows}

    roles = connection.execute(text(f"""
            SELECT id, visibility_scope, permissions
            FROM {SCHEMA}.roles
            """)).fetchall()

    for role_id, visibility_scope, permissions in roles:
        scopes = _migrate_role_scopes(visibility_scope, permissions, department_lab_map)
        connection.execute(
            text(f"""
                UPDATE {SCHEMA}.roles
                SET scopes = CAST(:scopes AS json)
                WHERE id = :role_id
                """),
            {"scopes": json.dumps(scopes, ensure_ascii=False), "role_id": role_id},
        )

    op.execute(f"ALTER TABLE {SCHEMA}.roles ALTER COLUMN scopes DROP DEFAULT")
    op.execute(f"ALTER TABLE {SCHEMA}.roles DROP COLUMN visibility_scope")
    op.execute(f"ALTER TABLE {SCHEMA}.roles DROP COLUMN permissions")


def downgrade() -> None:
    op.execute(f"""
        ALTER TABLE {SCHEMA}.roles
        ADD COLUMN visibility_scope JSON NOT NULL
        DEFAULT '{{"laboratory_ids": [], "department_ids": []}}'::json
        """)
    op.execute(f"""
        ALTER TABLE {SCHEMA}.roles
        ADD COLUMN permissions JSON NOT NULL DEFAULT '{{}}'::json
        """)

    connection = op.get_bind()
    roles = connection.execute(
        text(f"SELECT id, scopes FROM {SCHEMA}.roles")
    ).fetchall()

    for role_id, scopes in roles:
        visibility_scope, permissions = _scopes_to_legacy(scopes)
        connection.execute(
            text(f"""
                UPDATE {SCHEMA}.roles
                SET visibility_scope = CAST(:visibility_scope AS json),
                    permissions = CAST(:permissions AS json)
                WHERE id = :role_id
                """),
            {
                "visibility_scope": json.dumps(visibility_scope, ensure_ascii=False),
                "permissions": json.dumps(permissions, ensure_ascii=False),
                "role_id": role_id,
            },
        )

    op.execute(f"ALTER TABLE {SCHEMA}.roles DROP COLUMN scopes")
    op.execute(f"ALTER TABLE {SCHEMA}.roles ALTER COLUMN visibility_scope DROP DEFAULT")
    op.execute(f"ALTER TABLE {SCHEMA}.roles ALTER COLUMN permissions DROP DEFAULT")


def _migrate_role_scopes(
    visibility_scope: object,
    permissions: object,
    department_lab_map: dict[int, int],
) -> list[dict]:
    scope = visibility_scope if isinstance(visibility_scope, dict) else {}
    perms = permissions if isinstance(permissions, dict) else {}
    laboratory_ids = scope.get("laboratory_ids") or []
    department_ids = scope.get("department_ids") or []
    result: list[dict] = []
    seen: set[tuple[int, int | None]] = set()

    for laboratory_id in laboratory_ids:
        if not isinstance(laboratory_id, int) or laboratory_id <= 0:
            continue
        key = (laboratory_id, None)
        if key in seen:
            continue
        seen.add(key)
        result.append(
            {
                "laboratory_id": laboratory_id,
                "department_id": None,
                "permissions": perms,
            }
        )

    for department_id in department_ids:
        if not isinstance(department_id, int) or department_id <= 0:
            continue
        laboratory_id = department_lab_map.get(department_id)
        if laboratory_id is None:
            continue
        key = (laboratory_id, department_id)
        if key in seen:
            continue
        seen.add(key)
        result.append(
            {
                "laboratory_id": laboratory_id,
                "department_id": department_id,
                "permissions": perms,
            }
        )

    return result


def _scopes_to_legacy(scopes: object) -> tuple[dict, dict]:
    entries = scopes if isinstance(scopes, list) else []
    laboratory_ids: list[int] = []
    department_ids: list[int] = []
    permissions: dict = {}

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        laboratory_id = entry.get("laboratory_id")
        department_id = entry.get("department_id")
        if isinstance(laboratory_id, int) and laboratory_id > 0:
            if department_id is None and laboratory_id not in laboratory_ids:
                laboratory_ids.append(laboratory_id)
            elif (
                isinstance(department_id, int)
                and department_id > 0
                and department_id not in department_ids
            ):
                department_ids.append(department_id)
        if not permissions and isinstance(entry.get("permissions"), dict):
            permissions = entry["permissions"]

    return (
        {
            "laboratory_ids": sorted(laboratory_ids),
            "department_ids": sorted(department_ids),
        },
        permissions or {},
    )
