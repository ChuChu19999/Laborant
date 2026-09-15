"""sample types, test purposes, sample fields, role phone visibility

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-08 15:30:00.000000

"""
from __future__ import annotations
import json
import sqlalchemy as sa
from alembic import op
from core.config import get_database_schema

revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None

SCHEMA = get_database_schema()

SEED_SAMPLE_TYPES = (
    "Исследования - ОИС",
    "Исследования - прочие",
    "Паспортизация",
    "Внеплановые",
)


def upgrade() -> None:
    op.create_table(
        "sample_types",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False, comment="Название типа пробы"),
        sa.Column("laboratory_id", sa.Integer(), nullable=False, comment="ID лаборатории"),
        sa.Column("department_id", sa.Integer(), nullable=True, comment="ID подразделения"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("created_by_hash", sa.String(length=32), nullable=True),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("updated_by_hash", sa.String(length=32), nullable=True),
        sa.Column("deleted_by", sa.String(length=255), nullable=True),
        sa.Column("deleted_by_hash", sa.String(length=32), nullable=True),
        sa.ForeignKeyConstraint(
            ["laboratory_id"], [f"{SCHEMA}.laboratories.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["department_id"], [f"{SCHEMA}.departments.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )
    op.create_index(
        "unique_sample_type_name_lab",
        "sample_types",
        ["laboratory_id", "name"],
        unique=True,
        schema=SCHEMA,
        postgresql_where=sa.text("deleted_at IS NULL AND department_id IS NULL"),
    )
    op.create_index(
        "unique_sample_type_name_lab_dept",
        "sample_types",
        ["laboratory_id", "department_id", "name"],
        unique=True,
        schema=SCHEMA,
        postgresql_where=sa.text("deleted_at IS NULL AND department_id IS NOT NULL"),
    )
    op.create_index("idx_sample_type_laboratory", "sample_types", ["laboratory_id"], schema=SCHEMA)
    op.create_index("idx_sample_type_department", "sample_types", ["department_id"], schema=SCHEMA)

    op.create_table(
        "test_purposes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False, comment="Название цели испытаний"),
        sa.Column("laboratory_id", sa.Integer(), nullable=False, comment="ID лаборатории"),
        sa.Column("department_id", sa.Integer(), nullable=True, comment="ID подразделения"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("created_by_hash", sa.String(length=32), nullable=True),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("updated_by_hash", sa.String(length=32), nullable=True),
        sa.Column("deleted_by", sa.String(length=255), nullable=True),
        sa.Column("deleted_by_hash", sa.String(length=32), nullable=True),
        sa.ForeignKeyConstraint(
            ["laboratory_id"], [f"{SCHEMA}.laboratories.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["department_id"], [f"{SCHEMA}.departments.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )
    op.create_index(
        "unique_test_purpose_name_lab",
        "test_purposes",
        ["laboratory_id", "name"],
        unique=True,
        schema=SCHEMA,
        postgresql_where=sa.text("deleted_at IS NULL AND department_id IS NULL"),
    )
    op.create_index(
        "unique_test_purpose_name_lab_dept",
        "test_purposes",
        ["laboratory_id", "department_id", "name"],
        unique=True,
        schema=SCHEMA,
        postgresql_where=sa.text("deleted_at IS NULL AND department_id IS NOT NULL"),
    )
    op.create_index(
        "idx_test_purpose_laboratory", "test_purposes", ["laboratory_id"], schema=SCHEMA
    )
    op.create_index(
        "idx_test_purpose_department", "test_purposes", ["department_id"], schema=SCHEMA
    )

    conn = op.get_bind()
    labs = conn.execute(
        sa.text(f"SELECT id FROM {SCHEMA}.laboratories WHERE deleted_at IS NULL")
    ).mappings().all()
    for lab in labs:
        depts = conn.execute(
            sa.text(
                f"SELECT id FROM {SCHEMA}.departments "
                "WHERE laboratory_id = :laboratory_id AND deleted_at IS NULL"
            ),
            {"laboratory_id": lab["id"]},
        ).mappings().all()
        scopes = (
            [{"laboratory_id": lab["id"], "department_id": dept["id"]} for dept in depts]
            if depts
            else [{"laboratory_id": lab["id"], "department_id": None}]
        )
        for scope in scopes:
            for name in SEED_SAMPLE_TYPES:
                conn.execute(
                    sa.text(
                        f"INSERT INTO {SCHEMA}.sample_types (name, laboratory_id, department_id) "
                        "VALUES (:name, :laboratory_id, :department_id)"
                    ),
                    {"name": name, **scope},
                )

    op.alter_column(
        "samples",
        "sample_type",
        existing_type=sa.String(length=50),
        type_=sa.String(length=255),
        existing_nullable=True,
        schema=SCHEMA,
    )
    op.add_column(
        "samples",
        sa.Column("test_purpose", sa.String(length=255), nullable=True, comment="Цель испытаний"),
        schema=SCHEMA,
    )
    op.add_column(
        "samples",
        sa.Column(
            "customer_activity_place",
            sa.String(length=255),
            nullable=True,
            comment="Место осуществления деятельности заказчика",
        ),
        schema=SCHEMA,
    )
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
            "test_object_nd",
            sa.String(length=255),
            nullable=True,
            comment="Нормативный документ на объект испытаний",
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
        sa.Column(
            "sampling_request_date", sa.Date(), nullable=True, comment="Дата заявки отбора пробы"
        ),
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

    rows = conn.execute(sa.text(f"SELECT id, scopes FROM {SCHEMA}.roles")).mappings().all()
    for row in rows:
        scopes = row["scopes"]
        if not isinstance(scopes, list):
            continue
        changed = False
        new_scopes: list[dict] = []
        for scope in scopes:
            if not isinstance(scope, dict):
                new_scopes.append(scope)
                continue
            perms = scope.get("permissions")
            if not isinstance(perms, dict):
                new_scopes.append(scope)
                continue
            sampling_locations = perms.get("sampling_locations")
            if not isinstance(sampling_locations, dict):
                sampling_locations = {
                    "read": False,
                    "create": False,
                    "update": False,
                    "delete": False,
                    "visible_fields": [],
                }
            fields = sampling_locations.get("visible_fields")
            if not isinstance(fields, list):
                fields = []
            if "phone" not in fields:
                fields = [*fields, "phone"]
                sampling_locations = {**sampling_locations, "visible_fields": fields}
                perms = {**perms, "sampling_locations": sampling_locations}
                scope = {**scope, "permissions": perms}
                changed = True
            new_scopes.append(scope)
        if changed:
            conn.execute(
                sa.text(f"UPDATE {SCHEMA}.roles SET scopes = CAST(:scopes AS json) WHERE id = :id"),
                {"id": row["id"], "scopes": json.dumps(new_scopes, ensure_ascii=False)},
            )


def downgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.text(f"SELECT id, scopes FROM {SCHEMA}.roles")).mappings().all()
    for row in rows:
        scopes = row["scopes"]
        if not isinstance(scopes, list):
            continue
        changed = False
        new_scopes: list[dict] = []
        for scope in scopes:
            if not isinstance(scope, dict):
                new_scopes.append(scope)
                continue
            perms = scope.get("permissions")
            if not isinstance(perms, dict):
                new_scopes.append(scope)
                continue
            sampling_locations = perms.get("sampling_locations")
            if not isinstance(sampling_locations, dict):
                new_scopes.append(scope)
                continue
            fields = sampling_locations.get("visible_fields")
            if not isinstance(fields, list) or "phone" not in fields:
                new_scopes.append(scope)
                continue
            sampling_locations = {
                **sampling_locations,
                "visible_fields": [field for field in fields if field != "phone"],
            }
            perms = {**perms, "sampling_locations": sampling_locations}
            new_scopes.append({**scope, "permissions": perms})
            changed = True
        if changed:
            conn.execute(
                sa.text(f"UPDATE {SCHEMA}.roles SET scopes = CAST(:scopes AS json) WHERE id = :id"),
                {"id": row["id"], "scopes": json.dumps(new_scopes, ensure_ascii=False)},
            )

    op.drop_column("samples", "sampling_act_date", schema=SCHEMA)
    op.drop_column("samples", "sampling_plan_number", schema=SCHEMA)
    op.drop_column("samples", "sampling_request_date", schema=SCHEMA)
    op.drop_column("samples", "sampling_request_number", schema=SCHEMA)
    op.drop_column("samples", "test_object_nd", schema=SCHEMA)
    op.drop_column("samples", "sampling_method_nd", schema=SCHEMA)
    op.drop_column("samples", "customer_activity_place", schema=SCHEMA)
    op.drop_column("samples", "test_purpose", schema=SCHEMA)
    op.alter_column(
        "samples",
        "sample_type",
        existing_type=sa.String(length=255),
        type_=sa.String(length=50),
        existing_nullable=True,
        schema=SCHEMA,
    )
    op.drop_index("idx_test_purpose_department", table_name="test_purposes", schema=SCHEMA)
    op.drop_index("idx_test_purpose_laboratory", table_name="test_purposes", schema=SCHEMA)
    op.drop_index("unique_test_purpose_name_lab_dept", table_name="test_purposes", schema=SCHEMA)
    op.drop_index("unique_test_purpose_name_lab", table_name="test_purposes", schema=SCHEMA)
    op.drop_table("test_purposes", schema=SCHEMA)
    op.drop_index("idx_sample_type_department", table_name="sample_types", schema=SCHEMA)
    op.drop_index("idx_sample_type_laboratory", table_name="sample_types", schema=SCHEMA)
    op.drop_index("unique_sample_type_name_lab_dept", table_name="sample_types", schema=SCHEMA)
    op.drop_index("unique_sample_type_name_lab", table_name="sample_types", schema=SCHEMA)
    op.drop_table("sample_types", schema=SCHEMA)
