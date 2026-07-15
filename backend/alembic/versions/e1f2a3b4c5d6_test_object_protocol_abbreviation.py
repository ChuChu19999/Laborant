"""test_object protocol_abbreviation

Revision ID: e1f2a3b4c5d6
Revises: d5e6f7a8b9c0
Create Date: 2026-07-15 16:10:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "e1f2a3b4c5d6"
down_revision = "d5e6f7a8b9c0"
branch_labels = None
depends_on = None

SCHEMA = "laborant"

# Порядок важен: более специфичные подстроки раньше общих.
PROTOCOL_ABBREVIATION_SEED_RULES: tuple[tuple[str, str], ...] = (
    ("дегазированный конденсат", "дк"),
    ("нефтеконденсатная смесь", "нкс"),
    ("нефть калибровочная", "н"),
    ("нефть", "н"),
    ("дизельное топливо", "дт"),
    ("отработанные нефтепродукты", "он"),
    ("масло", "м"),
    ("смесь жидких углеводородов", "с"),
    ("ингибитор коррозии", "ик"),
)


def upgrade() -> None:
    op.add_column(
        "test_objects",
        sa.Column(
            "protocol_abbreviation",
            sa.String(length=8),
            nullable=True,
            comment="Аббревиатура для номера протокола",
        ),
        schema=SCHEMA,
    )

    connection = op.get_bind()
    for pattern, abbreviation in PROTOCOL_ABBREVIATION_SEED_RULES:
        connection.execute(
            sa.text(f"""
                UPDATE {SCHEMA}.test_objects
                SET protocol_abbreviation = :abbreviation
                WHERE protocol_abbreviation IS NULL
                  AND deleted_at IS NULL
                  AND lower(name) LIKE :pattern
                """),
            {
                "abbreviation": abbreviation,
                "pattern": f"%{pattern}%",
            },
        )


def downgrade() -> None:
    op.drop_column("test_objects", "protocol_abbreviation", schema=SCHEMA)
