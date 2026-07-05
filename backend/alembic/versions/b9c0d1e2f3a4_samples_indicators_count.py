"""samples indicators_count

Revision ID: b9c0d1e2f3a4
Revises: a7b8c9d0e1f2
Create Date: 2026-07-02 12:00:00.000000

"""
from collections import defaultdict
from typing import Optional

from alembic import op
import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from models.calculation import Calculation
from models.sample import Sample


revision = "b9c0d1e2f3a4"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None

SCHEMA = "laborant"

METHOD_VISCOSITY_20 = "при 20 °C"
METHOD_VISCOSITY_50 = "при 50 °C"
VISCOSITY_PAIR_INDICATOR_KEY = "viscosity_20_50"


def _normalize_method_name(value: Optional[str]) -> str:
    if not value:
        return ""
    text = value.strip().lower()
    return text.replace("℃", "°c")


def _is_viscosity_temperature_method(method_name: Optional[str]) -> bool:
    norm = _normalize_method_name(method_name)
    return norm in (
        _normalize_method_name(METHOD_VISCOSITY_20),
        _normalize_method_name(METHOD_VISCOSITY_50),
    )


def _indicator_key_for_calculation(
    research_method_id: int,
    method_name: Optional[str],
) -> str:
    if _is_viscosity_temperature_method(method_name):
        return VISCOSITY_PAIR_INDICATOR_KEY
    return f"method:{research_method_id}"


def _count_indicators_for_calculations(calculations: list[Calculation]) -> int:
    """Число показателей по пробе: вязкость при 20 и 50 °C вместе — один показатель."""
    if not calculations:
        return 0
    keys: set[str] = set()
    for calc in calculations:
        method = calc.research_method
        method_name = method.name if method is not None else None
        keys.add(_indicator_key_for_calculation(calc.research_method_id, method_name))
    return len(keys)


def _map_display_pok_count(n: int) -> int:
    """Подмена для старых проб при миграции: 1→2, 4→5, 6–8→9, 10–12→13."""
    if n == 1:
        return 2
    if n == 4:
        return 5
    if n in (6, 7, 8):
        return 9
    if n in (10, 11, 12):
        return 13
    return n


def _backfill_samples_indicators_count() -> None:
    bind = op.get_bind()
    session = Session(bind=bind)
    try:
        calculations = session.execute(
            select(Calculation)
            .where(Calculation.deleted_at.is_(None))
            .options(selectinload(Calculation.research_method))
        ).scalars().all()
        by_sample: dict[int, list[Calculation]] = defaultdict(list)
        for calc in calculations:
            by_sample[calc.sample_id].append(calc)

        sample_ids = session.execute(select(Sample.id)).scalars().all()
        for sample_id in sample_ids:
            sample = session.get(Sample, sample_id)
            if sample is None:
                continue
            calcs = by_sample.get(sample_id, [])
            raw_count = _count_indicators_for_calculations(calcs)
            sample.indicators_count = _map_display_pok_count(raw_count)
        session.commit()
    finally:
        session.close()


def upgrade() -> None:
    op.add_column(
        "samples",
        sa.Column(
            "indicators_count",
            sa.Integer(),
            nullable=True,
            comment="Количество показателей",
        ),
        schema=SCHEMA,
    )
    _backfill_samples_indicators_count()
    op.alter_column(
        "samples",
        "indicators_count",
        existing_type=sa.Integer(),
        nullable=False,
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_column("samples", "indicators_count", schema=SCHEMA)
