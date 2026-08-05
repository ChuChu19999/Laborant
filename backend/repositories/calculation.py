from __future__ import annotations
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.calculation import Calculation
from models.research import ResearchMethod
from models.sample import Sample
from repositories.base import (
    add_and_flush,
    execute_scalar_one_or_none,
    execute_scalars_all,
    filter_not_deleted,
)
from utils.pagination import apply_pagination, get_total_count
from utils.sorting import build_order_by


async def get_calculation_by_id(
    db: AsyncSession, calculation_id: int, include_deleted: bool = False
) -> Calculation | None:
    """Получить расчет по ID."""
    query = (
        select(Calculation)
        .where(Calculation.id == calculation_id)
        .options(
            selectinload(Calculation.sample).selectinload(Sample.laboratory),
            selectinload(Calculation.sample).selectinload(Sample.department),
            selectinload(Calculation.laboratory),
            selectinload(Calculation.department),
            selectinload(Calculation.research_method),
        )
    )
    if not include_deleted:
        query = filter_not_deleted(query, Calculation.deleted_at)
    return await execute_scalar_one_or_none(db, query)


async def get_calculations_by_sample(
    db: AsyncSession,
    sample_id: int | None = None,
    sample_ids: list[int] | None = None,
    include_deleted: bool = False,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> list[Calculation]:
    """Получить список расчетов по пробе без пагинации."""
    query = select(Calculation).options(
        selectinload(Calculation.sample),
        selectinload(Calculation.laboratory),
        selectinload(Calculation.department),
        selectinload(Calculation.research_method),
    )

    if not include_deleted:
        query = filter_not_deleted(query, Calculation.deleted_at)

    conditions = []
    if sample_id:
        conditions.append(Calculation.sample_id == sample_id)
    elif sample_ids:
        conditions.append(Calculation.sample_id.in_(sample_ids))
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "created_at": Calculation.created_at,
        "laboratory_activity_date": Calculation.laboratory_activity_date,
    }
    order_by = build_order_by(sort_by, sort_order, sort_mapping, Calculation.created_at)
    query = query.order_by(order_by)

    return await execute_scalars_all(db, query)


async def get_calculations(
    db: AsyncSession,
    sample_id: int | None = None,
    sample_ids: list[int] | None = None,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    research_method_id: int | None = None,
    include_deleted: bool = False,
    page: int | None = None,
    page_size: int | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[Calculation], int]:
    """Получить список расчетов."""
    query = select(Calculation).options(
        selectinload(Calculation.sample),
        selectinload(Calculation.laboratory),
        selectinload(Calculation.department),
        selectinload(Calculation.research_method),
    )

    if not include_deleted:
        query = filter_not_deleted(query, Calculation.deleted_at)

    conditions = []
    if sample_id:
        conditions.append(Calculation.sample_id == sample_id)
    elif sample_ids:
        conditions.append(Calculation.sample_id.in_(sample_ids))
    if laboratory_id:
        conditions.append(Calculation.laboratory_id == laboratory_id)
    if department_id:
        conditions.append(Calculation.department_id == department_id)
    if research_method_id:
        conditions.append(Calculation.research_method_id == research_method_id)
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "created_at": Calculation.created_at,
        "laboratory_activity_date": Calculation.laboratory_activity_date,
    }
    order_by = build_order_by(sort_by, sort_order, sort_mapping, Calculation.created_at)
    query = query.order_by(order_by)

    count_query = select(func.count()).select_from(Calculation)
    if not include_deleted:
        count_query = filter_not_deleted(count_query, Calculation.deleted_at)
    count_conditions = []
    if sample_id:
        count_conditions.append(Calculation.sample_id == sample_id)
    elif sample_ids:
        count_conditions.append(Calculation.sample_id.in_(sample_ids))
    if laboratory_id:
        count_conditions.append(Calculation.laboratory_id == laboratory_id)
    if department_id:
        count_conditions.append(Calculation.department_id == department_id)
    if research_method_id:
        count_conditions.append(Calculation.research_method_id == research_method_id)
    if count_conditions:
        count_query = count_query.where(*count_conditions)

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        query = apply_pagination(query, page, page_size)

    calculations = await execute_scalars_all(db, query)
    return calculations, total


async def exists_calculation_by_sample_and_method(
    db: AsyncSession,
    sample_id: int,
    research_method_id: int,
    exclude_id: int | None = None,
) -> bool:
    """Проверить существование расчёта для пробы и метода."""
    query = filter_not_deleted(
        select(Calculation).where(
            Calculation.sample_id == sample_id,
            Calculation.research_method_id == research_method_id,
        ),
        Calculation.deleted_at,
    )
    if exclude_id is not None:
        query = query.where(Calculation.id != exclude_id)

    existing = await execute_scalar_one_or_none(db, query)
    return existing is not None


async def add_calculation(db: AsyncSession, calculation: Calculation) -> Calculation:
    """Добавить расчёт в сессию."""
    await add_and_flush(db, calculation)
    return calculation


async def get_calculations_grouped_by_sample_ids(
    db: AsyncSession,
    sample_ids: list[int],
) -> dict[int, list[Calculation]]:
    """Расчёты по списку проб, сгруппированные по sample_id."""
    if not sample_ids:
        return {}

    query = filter_not_deleted(
        select(Calculation).where(Calculation.sample_id.in_(sample_ids)),
        Calculation.deleted_at,
    ).options(
        selectinload(Calculation.research_method).selectinload(ResearchMethod.groups),
    )
    calculations = await execute_scalars_all(db, query)
    by_sample: dict[int, list[Calculation]] = {}
    for calc in calculations:
        by_sample.setdefault(calc.sample_id, []).append(calc)
    return by_sample
