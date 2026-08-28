from __future__ import annotations
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.calculation import Calculation
from models.research import ResearchMethod
from models.sample import Sample
from repositories.base import (
    add_and_flush,
    execute_exists,
    execute_scalar_one_or_none,
    execute_scalars_all,
    filter_not_deleted,
    filter_not_deleted_unless,
)
from utils.pagination import apply_pagination, get_total_count
from utils.sorting import build_order_by


def _build_calculation_conditions(
    *,
    sample_id: int | None = None,
    sample_ids: list[int] | None = None,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    research_method_id: int | None = None,
) -> list[ColumnElement[bool]]:
    """Собрать условия фильтрации расчётов."""
    conditions: list[ColumnElement[bool]] = []
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
    return conditions


def _calculation_response_load_options():
    """Eager load для CalculationResponse (вложенный SampleResponse со связями)."""
    return (
        selectinload(Calculation.sample).selectinload(Sample.laboratory),
        selectinload(Calculation.sample).selectinload(Sample.department),
        selectinload(Calculation.sample).selectinload(Sample.branch),
        selectinload(Calculation.sample).selectinload(Sample.sampling_location),
        selectinload(Calculation.laboratory),
        selectinload(Calculation.department),
        selectinload(Calculation.research_method),
    )


async def get_calculation_by_id(
    db: AsyncSession, calculation_id: int, include_deleted: bool = False
) -> Calculation | None:
    """Получить расчёт по ID."""
    query = select(Calculation).where(Calculation.id == calculation_id).options(*_calculation_response_load_options())
    query = filter_not_deleted_unless(query, Calculation.deleted_at, include_deleted)
    return await execute_scalar_one_or_none(db, query)


async def get_calculations_by_sample(
    db: AsyncSession,
    sample_id: int | None = None,
    sample_ids: list[int] | None = None,
    include_deleted: bool = False,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> list[Calculation]:
    """Получить список расчётов по пробе без пагинации."""
    query = select(Calculation).options(*_calculation_response_load_options())

    query = filter_not_deleted_unless(query, Calculation.deleted_at, include_deleted)

    conditions = _build_calculation_conditions(sample_id=sample_id, sample_ids=sample_ids)
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
    """Получить список расчётов."""
    query = select(Calculation).options(*_calculation_response_load_options())

    query = filter_not_deleted_unless(query, Calculation.deleted_at, include_deleted)

    conditions = _build_calculation_conditions(
        sample_id=sample_id,
        sample_ids=sample_ids,
        laboratory_id=laboratory_id,
        department_id=department_id,
        research_method_id=research_method_id,
    )
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "created_at": Calculation.created_at,
        "laboratory_activity_date": Calculation.laboratory_activity_date,
    }
    order_by = build_order_by(sort_by, sort_order, sort_mapping, Calculation.created_at)
    query = query.order_by(order_by)

    count_query = select(func.count()).select_from(Calculation)
    count_query = filter_not_deleted_unless(count_query, Calculation.deleted_at, include_deleted)
    if conditions:
        count_query = count_query.where(*conditions)

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
        select(Calculation.id).where(
            Calculation.sample_id == sample_id,
            Calculation.research_method_id == research_method_id,
        ),
        Calculation.deleted_at,
    )
    if exclude_id is not None:
        query = query.where(Calculation.id != exclude_id)
    return await execute_exists(db, query)


async def add_calculation(db: AsyncSession, calculation: Calculation) -> Calculation:
    """Добавить расчёт."""
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


async def get_executor_sample_pairs(
    db: AsyncSession,
    sample_ids: list[int],
) -> list[tuple[str, int]]:
    """Вернуть пары (executor, sample_id) неудалённых расчётов с исполнителем."""
    if not sample_ids:
        return []
    query = (
        select(Calculation.executor, Calculation.sample_id)
        .where(Calculation.sample_id.in_(sample_ids))
        .where(Calculation.deleted_at.is_(None))
        .where(Calculation.executor.isnot(None))
    )
    result = await db.execute(query)
    return [(str(executor), int(sample_id)) for executor, sample_id in result.all()]


async def get_sample_ids_with_deleted_research_methods(
    db: AsyncSession,
    sample_ids: list[int],
) -> set[int]:
    """ID проб, у которых есть расчёт с мягко удалённым методом исследования."""
    if not sample_ids:
        return set()
    query = (
        select(Calculation.sample_id)
        .join(ResearchMethod, Calculation.research_method_id == ResearchMethod.id)
        .where(Calculation.sample_id.in_(sample_ids))
        .where(Calculation.deleted_at.is_(None))
        .where(ResearchMethod.deleted_at.isnot(None))
        .distinct()
    )
    result = await db.execute(query)
    return {row[0] for row in result.all()}
