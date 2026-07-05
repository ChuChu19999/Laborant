"""test_objects catalog

Revision ID: a8f3c1d92e40
Revises: 2a2272d64c04
Create Date: 2026-05-27 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "a8f3c1d92e40"
down_revision = "2a2272d64c04"
branch_labels = None
depends_on = None


SEED_TEST_OBJECTS = [
    ("дегазированный конденсат", "condensate"),
    ("нефть", "oil"),
    ("нефть калибровочная", "oil_calibration"),
    ("нефтеконденсатная смесь", "oil_condensate_mixture"),
    ("дизельное топливо", "diesel_fuel"),
    ("отработанные нефтепродукты", "spent_oil_products"),
    ("масло турбинное", "turbine_oil"),
    ("масло авиационное", "aviation_oil"),
    ("смесь жидких углеводородов", "liquid_hydrocarbons_mixture"),
    ("ингибитор коррозии", "corrosion_inhibitor"),
]


def upgrade() -> None:
    op.create_table(
        "test_objects",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "name",
            sa.String(length=255),
            nullable=False,
            comment="Наименование объекта испытаний",
        ),
        sa.Column(
            "tag",
            sa.String(length=50),
            nullable=False,
            comment="Тег для связи с методами исследования",
        ),
        sa.Column(
            "visibility_scope",
            sa.JSON(),
            nullable=False,
            comment="Область видимости: laboratory_ids, department_ids",
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
        sa.PrimaryKeyConstraint("id"),
        schema="laborant",
    )
    op.create_index(
        "unique_test_object_name",
        "test_objects",
        ["name"],
        unique=True,
        schema="laborant",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_test_object_tag", "test_objects", ["tag"], unique=False, schema="laborant"
    )
    op.create_index(
        "idx_test_object_created_at",
        "test_objects",
        ["created_at"],
        unique=False,
        schema="laborant",
    )
    op.create_index(
        "idx_test_object_updated_at",
        "test_objects",
        ["updated_at"],
        unique=False,
        schema="laborant",
    )
    op.create_index(
        op.f("ix_laborant_test_objects_name"),
        "test_objects",
        ["name"],
        unique=False,
        schema="laborant",
    )
    op.create_index(
        op.f("ix_laborant_test_objects_tag"),
        "test_objects",
        ["tag"],
        unique=False,
        schema="laborant",
    )
    op.create_index(
        op.f("ix_laborant_test_objects_deleted_at"),
        "test_objects",
        ["deleted_at"],
        unique=False,
        schema="laborant",
    )

    test_objects = sa.table(
        "test_objects",
        sa.column("name", sa.String),
        sa.column("tag", sa.String),
        sa.column("visibility_scope", sa.JSON),
        schema="laborant",
    )
    op.bulk_insert(
        test_objects,
        [
            {
                "name": name,
                "tag": tag,
                "visibility_scope": {"laboratory_ids": [], "department_ids": []},
            }
            for name, tag in SEED_TEST_OBJECTS
        ],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_laborant_test_objects_deleted_at"),
        table_name="test_objects",
        schema="laborant",
    )
    op.drop_index(
        op.f("ix_laborant_test_objects_tag"),
        table_name="test_objects",
        schema="laborant",
    )
    op.drop_index(
        op.f("ix_laborant_test_objects_name"),
        table_name="test_objects",
        schema="laborant",
    )
    op.drop_index(
        "idx_test_object_updated_at", table_name="test_objects", schema="laborant"
    )
    op.drop_index(
        "idx_test_object_created_at", table_name="test_objects", schema="laborant"
    )
    op.drop_index("idx_test_object_tag", table_name="test_objects", schema="laborant")
    op.drop_index(
        "unique_test_object_name", table_name="test_objects", schema="laborant"
    )
    op.drop_table("test_objects", schema="laborant")
