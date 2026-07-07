"""refactor models indexes and nd_norm method_data value key

Revision ID: c4f5a6b7d8e9
Revises: b9c0d1e2f3a4
Create Date: 2026-07-06 10:55:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "c4f5a6b7d8e9"
down_revision = "b9c0d1e2f3a4"
branch_labels = None
depends_on = None

SCHEMA = "laborant"

AUDIT_COLUMNS = (
    "created_at",
    "updated_at",
    "deleted_at",
    "created_by",
    "created_by_hash",
    "updated_by",
    "updated_by_hash",
    "deleted_by",
    "deleted_by_hash",
)

BASE_MODEL_TABLES = (
    "laboratories",
    "research_method_groups",
    "departments",
    "branches",
    "equipments",
    "protocol_templates",
    "research_methods",
    "selection_conditions",
    "mass_fraction_oil_refraction_tables",
    "protocols",
    "calculations",
    "samples",
    "sampling_locations",
    "well_modes",
    "report_templates",
    "nd_norms",
    "roles",
    "test_objects",
)

EXPLICIT_CREATED_UPDATED_INDEXES = (
    ("laboratories", "idx_laboratory_created_at", ["created_at"]),
    ("laboratories", "idx_laboratory_updated_at", ["updated_at"]),
    ("research_method_groups", "idx_research_method_group_created_at", ["created_at"]),
    ("research_method_groups", "idx_research_method_group_updated_at", ["updated_at"]),
    ("departments", "idx_department_created_at", ["created_at"]),
    ("departments", "idx_department_updated_at", ["updated_at"]),
    ("branches", "idx_branch_created_at", ["created_at"]),
    ("branches", "idx_branch_updated_at", ["updated_at"]),
    ("equipments", "idx_equipment_created_at", ["created_at"]),
    ("equipments", "idx_equipment_updated_at", ["updated_at"]),
    ("protocol_templates", "idx_protocol_template_created_at", ["created_at"]),
    ("protocol_templates", "idx_protocol_template_updated_at", ["updated_at"]),
    ("research_methods", "idx_research_method_created_at", ["created_at"]),
    ("research_methods", "idx_research_method_updated_at", ["updated_at"]),
    ("selection_conditions", "idx_selection_conditions_created_at", ["created_at"]),
    ("selection_conditions", "idx_selection_conditions_updated_at", ["updated_at"]),
    (
        "mass_fraction_oil_refraction_tables",
        "idx_refraction_table_created_at",
        ["created_at"],
    ),
    (
        "mass_fraction_oil_refraction_tables",
        "idx_refraction_table_updated_at",
        ["updated_at"],
    ),
    ("protocols", "idx_protocol_created_at", ["created_at"]),
    ("protocols", "idx_protocol_updated_at", ["updated_at"]),
    ("calculations", "idx_calculation_created_at", ["created_at"]),
    ("calculations", "idx_calculation_updated_at", ["updated_at"]),
    ("samples", "idx_sample_created_at", ["created_at"]),
    ("samples", "idx_sample_updated_at", ["updated_at"]),
    ("sampling_locations", "idx_sampling_location_created_at", ["created_at"]),
    ("sampling_locations", "idx_sampling_location_updated_at", ["updated_at"]),
    ("well_modes", "idx_well_mode_created_at", ["created_at"]),
    ("well_modes", "idx_well_mode_updated_at", ["updated_at"]),
    ("report_templates", "idx_report_template_created_at", ["created_at"]),
    ("report_templates", "idx_report_template_updated_at", ["updated_at"]),
    ("nd_norms", "idx_nd_norm_created_at", ["created_at"]),
    ("nd_norms", "idx_nd_norm_updated_at", ["updated_at"]),
    ("roles", "idx_role_created_at", ["created_at"]),
    ("roles", "idx_role_updated_at", ["updated_at"]),
    ("test_objects", "idx_test_object_created_at", ["created_at"]),
    ("test_objects", "idx_test_object_updated_at", ["updated_at"]),
)

DUPLICATE_AUTO_INDEXES = (
    ("laboratories", "name"),
    ("departments", "laboratory_id"),
    ("branches", "name"),
    ("branches", "laboratory_id"),
    ("equipments", "type"),
    ("equipments", "name"),
    ("equipments", "verification_end_date"),
    ("protocol_templates", "name"),
    ("research_methods", "name"),
    ("research_methods", "rounding_type"),
    ("research_methods", "laboratory_id"),
    ("research_methods", "department_id"),
    ("research_methods", "sort_order"),
    ("research_method_groups", "name"),
    ("research_method_groups", "sort_order"),
    ("selection_conditions", "laboratory_id"),
    ("selection_conditions", "department_id"),
    ("mass_fraction_oil_refraction_tables", "research_method_id"),
    ("mass_fraction_oil_refraction_tables", "c_value"),
    ("protocols", "test_protocol_number"),
    ("protocols", "laboratory_id"),
    ("protocols", "department_id"),
    ("samples", "registration_number"),
    ("samples", "laboratory_id"),
    ("samples", "department_id"),
    ("calculations", "sample_id"),
    ("calculations", "laboratory_id"),
    ("calculations", "department_id"),
    ("calculations", "research_method_id"),
    ("sampling_locations", "branch_id"),
    ("sampling_locations", "name"),
    ("well_modes", "branch_id"),
    ("well_modes", "name"),
    ("nd_norms", "name"),
    ("nd_norms", "test_object"),
    ("report_templates", "report_type"),
    ("roles", "name"),
    ("roles", "role_type"),
    ("roles", "deleted_at"),
    ("test_objects", "name"),
    ("test_objects", "tag"),
    ("test_objects", "deleted_at"),
)

LEGACY_INDEXES = (("roles", "unique_role_name"),)


def _auto_index_name(table_name: str, column_name: str) -> str:
    return f"ix_{SCHEMA}_{table_name}_{column_name}"


def _pg_index_name(index_name: str) -> str:
    return index_name[:63]


def _drop_index(index_name: str, table_name: str) -> None:
    del table_name
    pg_index_name = _pg_index_name(index_name)
    op.execute(sa.text(f'DROP INDEX IF EXISTS "{SCHEMA}"."{pg_index_name}"'))


def _create_index(index_name: str, table_name: str, columns: list[str]) -> None:
    pg_index_name = _pg_index_name(index_name)
    op.create_index(pg_index_name, table_name, columns, unique=False, schema=SCHEMA)


def upgrade() -> None:
    for table_name in BASE_MODEL_TABLES:
        for column_name in AUDIT_COLUMNS:
            _drop_index(_auto_index_name(table_name, column_name), table_name)

    for table_name, index_name, _columns in EXPLICIT_CREATED_UPDATED_INDEXES:
        _drop_index(index_name, table_name)

    for table_name, column_name in DUPLICATE_AUTO_INDEXES:
        _drop_index(_auto_index_name(table_name, column_name), table_name)

    for table_name, index_name in LEGACY_INDEXES:
        _drop_index(index_name, table_name)

    op.alter_column(
        "nd_norms",
        "method_data",
        existing_type=sa.JSON(),
        comment="Значения нормы по методам: method_id и value",
        schema=SCHEMA,
    )

    op.execute(sa.text(f"""
            UPDATE {SCHEMA}.nd_norms AS n
            SET method_data = converted.new_data
            FROM (
                SELECT
                    nd.id,
                    jsonb_agg(
                        jsonb_build_object(
                            'method_id', elem->'method_id',
                            'value', to_jsonb(
                                COALESCE(elem->>'value', elem->>'text', '')
                            )
                        )
                        ORDER BY ordinality
                    ) AS new_data
                FROM {SCHEMA}.nd_norms AS nd
                CROSS JOIN LATERAL jsonb_array_elements(nd.method_data::jsonb)
                    WITH ORDINALITY AS t(elem, ordinality)
                WHERE jsonb_typeof(nd.method_data::jsonb) = 'array'
                GROUP BY nd.id
            ) AS converted
            WHERE n.id = converted.id
            """))


def downgrade() -> None:
    op.execute(sa.text(f"""
            UPDATE {SCHEMA}.nd_norms AS n
            SET method_data = converted.new_data
            FROM (
                SELECT
                    nd.id,
                    jsonb_agg(
                        jsonb_build_object(
                            'method_id', elem->'method_id',
                            'text', to_jsonb(
                                COALESCE(elem->>'text', elem->>'value', '')
                            )
                        )
                        ORDER BY ordinality
                    ) AS new_data
                FROM {SCHEMA}.nd_norms AS nd
                CROSS JOIN LATERAL jsonb_array_elements(nd.method_data::jsonb)
                    WITH ORDINALITY AS t(elem, ordinality)
                WHERE jsonb_typeof(nd.method_data::jsonb) = 'array'
                GROUP BY nd.id
            ) AS converted
            WHERE n.id = converted.id
            """))

    op.alter_column(
        "nd_norms",
        "method_data",
        existing_type=sa.JSON(),
        comment="Тексты нормы по методам исследования: method_id и text",
        schema=SCHEMA,
    )

    op.create_index(
        "unique_role_name",
        "roles",
        ["name"],
        unique=True,
        schema=SCHEMA,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    for table_name, column_name in DUPLICATE_AUTO_INDEXES:
        _create_index(
            _auto_index_name(table_name, column_name), table_name, [column_name]
        )

    for table_name, index_name, columns in EXPLICIT_CREATED_UPDATED_INDEXES:
        _create_index(index_name, table_name, columns)

    for table_name in BASE_MODEL_TABLES:
        for column_name in AUDIT_COLUMNS:
            _create_index(
                _auto_index_name(table_name, column_name), table_name, [column_name]
            )
