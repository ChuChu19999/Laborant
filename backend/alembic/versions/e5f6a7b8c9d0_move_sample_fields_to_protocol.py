"""move sampling request/plan/act fields from samples to protocols

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-09-09 16:35:00.000000

"""
from __future__ import annotations
import json
import sqlalchemy as sa
from alembic import op
from core.config import get_database_schema

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None

SCHEMA = get_database_schema()

MOVED_VISIBLE_FIELDS = (
    "sampling_request_number",
    "sampling_request_date",
    "sampling_method_nd",
    "sampling_plan_number",
    "sampling_act_date",
)


def _migrate_scopes_upgrade(scopes: list) -> tuple[list, bool]:
    """Перенести ключи visible_fields с samples на protocols."""
    changed = False
    new_scopes: list = []
    for scope in scopes:
        if not isinstance(scope, dict):
            new_scopes.append(scope)
            continue
        perms = scope.get("permissions")
        if not isinstance(perms, dict):
            new_scopes.append(scope)
            continue

        samples = perms.get("samples")
        if not isinstance(samples, dict):
            samples = {"visible_fields": [], "update": False, "delete": False}

        sample_fields = samples.get("visible_fields")
        if not isinstance(sample_fields, list):
            sample_fields = []

        moved = [field for field in sample_fields if field in MOVED_VISIBLE_FIELDS]
        remaining = [field for field in sample_fields if field not in MOVED_VISIBLE_FIELDS]

        protocols = perms.get("protocols")
        if not isinstance(protocols, dict):
            protocols = {
                "read": False,
                "create": False,
                "update": False,
                "delete": False,
                "visible_fields": [],
            }
        protocol_fields = protocols.get("visible_fields")
        if not isinstance(protocol_fields, list):
            protocol_fields = []

        new_protocol_fields = list(protocol_fields)
        for field in moved:
            if field not in new_protocol_fields:
                new_protocol_fields.append(field)

        scope_changed = remaining != sample_fields or new_protocol_fields != protocol_fields
        if "visible_fields" not in protocols:
            scope_changed = True

        if scope_changed:
            samples = {**samples, "visible_fields": remaining}
            protocols = {**protocols, "visible_fields": new_protocol_fields}
            perms = {**perms, "samples": samples, "protocols": protocols}
            scope = {**scope, "permissions": perms}
            changed = True

        new_scopes.append(scope)
    return new_scopes, changed


def _migrate_scopes_downgrade(scopes: list) -> tuple[list, bool]:
    """Вернуть ключи visible_fields с protocols на samples."""
    changed = False
    new_scopes: list = []
    for scope in scopes:
        if not isinstance(scope, dict):
            new_scopes.append(scope)
            continue
        perms = scope.get("permissions")
        if not isinstance(perms, dict):
            new_scopes.append(scope)
            continue

        protocols = perms.get("protocols")
        if not isinstance(protocols, dict):
            new_scopes.append(scope)
            continue

        protocol_fields = protocols.get("visible_fields")
        if not isinstance(protocol_fields, list):
            protocol_fields = []

        moved = [field for field in protocol_fields if field in MOVED_VISIBLE_FIELDS]
        remaining_protocol = [field for field in protocol_fields if field not in MOVED_VISIBLE_FIELDS]

        samples = perms.get("samples")
        if not isinstance(samples, dict):
            samples = {"visible_fields": [], "update": False, "delete": False}
        sample_fields = samples.get("visible_fields")
        if not isinstance(sample_fields, list):
            sample_fields = []

        new_sample_fields = list(sample_fields)
        for field in moved:
            if field not in new_sample_fields:
                new_sample_fields.append(field)

        scope_changed = (
            remaining_protocol != protocol_fields
            or new_sample_fields != sample_fields
            or "visible_fields" in protocols
        )
        if not scope_changed:
            new_scopes.append(scope)
            continue

        protocols = {**protocols, "visible_fields": remaining_protocol}
        # На downgrade убираем visible_fields у protocols, если список пуст — оставляем ключ пустым
        # для совместимости со старыми ролями без поля; normalize на бэке допишет дефолт.
        samples = {**samples, "visible_fields": new_sample_fields}
        perms = {**perms, "samples": samples, "protocols": protocols}
        new_scopes.append({**scope, "permissions": perms})
        changed = True
    return new_scopes, changed


def upgrade() -> None:
    op.add_column(
        "protocols",
        sa.Column(
            "sampling_request_number",
            sa.String(length=100),
            nullable=True,
            comment="Номер заявки на отбор пробы",
        ),
        schema=SCHEMA,
    )
    op.add_column(
        "protocols",
        sa.Column("sampling_request_date", sa.Date(), nullable=True, comment="Дата заявки отбора пробы"),
        schema=SCHEMA,
    )
    op.add_column(
        "protocols",
        sa.Column(
            "sampling_method_nd",
            sa.String(length=255),
            nullable=True,
            comment="Нормативный документ на метод отбора пробы",
        ),
        schema=SCHEMA,
    )
    op.add_column(
        "protocols",
        sa.Column(
            "sampling_plan_number",
            sa.String(length=100),
            nullable=True,
            comment="Номер плана отбора проб",
        ),
        schema=SCHEMA,
    )
    op.add_column(
        "protocols",
        sa.Column("sampling_act_date", sa.Date(), nullable=True, comment="Дата акта отбора"),
        schema=SCHEMA,
    )

    conn = op.get_bind()
    rows = conn.execute(sa.text(f"SELECT id, scopes FROM {SCHEMA}.roles")).mappings().all()
    for row in rows:
        scopes = row["scopes"]
        if not isinstance(scopes, list):
            continue
        new_scopes, changed = _migrate_scopes_upgrade(scopes)
        if changed:
            conn.execute(
                sa.text(f"UPDATE {SCHEMA}.roles SET scopes = CAST(:scopes AS json) WHERE id = :id"),
                {"id": row["id"], "scopes": json.dumps(new_scopes, ensure_ascii=False)},
            )

    op.drop_column("samples", "sampling_act_date", schema=SCHEMA)
    op.drop_column("samples", "sampling_plan_number", schema=SCHEMA)
    op.drop_column("samples", "sampling_request_date", schema=SCHEMA)
    op.drop_column("samples", "sampling_request_number", schema=SCHEMA)
    op.drop_column("samples", "sampling_method_nd", schema=SCHEMA)


def downgrade() -> None:
    op.add_column(
        "samples",
        sa.Column(
            "sampling_method_nd",
            sa.String(length=255),
            nullable=True,
            comment="Нормативный документ на метод отбора пробы",
        ),
        schema=SCHEMA,
    )
    op.add_column(
        "samples",
        sa.Column(
            "sampling_request_number",
            sa.String(length=100),
            nullable=True,
            comment="Номер заявки на отбор пробы",
        ),
        schema=SCHEMA,
    )
    op.add_column(
        "samples",
        sa.Column("sampling_request_date", sa.Date(), nullable=True, comment="Дата заявки отбора пробы"),
        schema=SCHEMA,
    )
    op.add_column(
        "samples",
        sa.Column(
            "sampling_plan_number",
            sa.String(length=100),
            nullable=True,
            comment="Номер плана отбора проб",
        ),
        schema=SCHEMA,
    )
    op.add_column(
        "samples",
        sa.Column("sampling_act_date", sa.Date(), nullable=True, comment="Дата акта отбора проб"),
        schema=SCHEMA,
    )

    conn = op.get_bind()
    rows = conn.execute(sa.text(f"SELECT id, scopes FROM {SCHEMA}.roles")).mappings().all()
    for row in rows:
        scopes = row["scopes"]
        if not isinstance(scopes, list):
            continue
        new_scopes, changed = _migrate_scopes_downgrade(scopes)
        if changed:
            conn.execute(
                sa.text(f"UPDATE {SCHEMA}.roles SET scopes = CAST(:scopes AS json) WHERE id = :id"),
                {"id": row["id"], "scopes": json.dumps(new_scopes, ensure_ascii=False)},
            )

    op.drop_column("protocols", "sampling_act_date", schema=SCHEMA)
    op.drop_column("protocols", "sampling_plan_number", schema=SCHEMA)
    op.drop_column("protocols", "sampling_method_nd", schema=SCHEMA)
    op.drop_column("protocols", "sampling_request_date", schema=SCHEMA)
    op.drop_column("protocols", "sampling_request_number", schema=SCHEMA)
