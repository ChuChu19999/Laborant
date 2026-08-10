from __future__ import annotations
from sqlalchemy import Float, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.mass_fraction import MassFractionOilRefractionTable
from repositories.base import (
    add_and_flush,
    execute_scalar_one_or_none,
    execute_scalars_all,
    filter_not_deleted,
)
from utils.pagination import apply_pagination, get_total_count
from utils.sorting import build_order_by


async def get_mass_fraction_oil_refraction_table_by_id(
    db: AsyncSession, table_id: int, include_deleted: bool = False
) -> MassFractionOilRefractionTable | None:
    """Получить точку градуировочного графика по ID."""
    query = (
        select(MassFractionOilRefractionTable)
        .where(MassFractionOilRefractionTable.id == table_id)
        .options(selectinload(MassFractionOilRefractionTable.research_method))
    )
    if not include_deleted:
        query = filter_not_deleted(query, MassFractionOilRefractionTable.deleted_at)
    return await execute_scalar_one_or_none(db, query)


async def get_mass_fraction_oil_refraction_tables(
    db: AsyncSession,
    research_method_id: int | None = None,
    page: int | None = None,
    page_size: int | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[MassFractionOilRefractionTable], int]:
    """Получить точки градуировочного графика."""
    query = filter_not_deleted(
        select(MassFractionOilRefractionTable),
        MassFractionOilRefractionTable.deleted_at,
    ).options(selectinload(MassFractionOilRefractionTable.research_method))

    if research_method_id:
        query = query.where(MassFractionOilRefractionTable.research_method_id == research_method_id)

    if sort_by == "c_value":
        c_value_numeric = cast(MassFractionOilRefractionTable.c_value, Float)
        if sort_order == "desc":
            query = query.order_by(c_value_numeric.desc())
        else:
            query = query.order_by(c_value_numeric.asc())
    else:
        sort_mapping = {
            "created_at": MassFractionOilRefractionTable.created_at,
        }
        order_by = build_order_by(
            sort_by,
            sort_order,
            sort_mapping,
            cast(MassFractionOilRefractionTable.c_value, Float),
            default_order="asc",
        )
        query = query.order_by(order_by)

    count_query = filter_not_deleted(
        select(func.count()).select_from(MassFractionOilRefractionTable),
        MassFractionOilRefractionTable.deleted_at,
    )
    if research_method_id:
        count_query = count_query.where(MassFractionOilRefractionTable.research_method_id == research_method_id)

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        query = apply_pagination(query, page, page_size)

    tables = await execute_scalars_all(db, query)
    return tables, total


async def add_mass_fraction_oil_refraction_table(
    db: AsyncSession, table: MassFractionOilRefractionTable
) -> MassFractionOilRefractionTable:
    """Добавить точку градуировочного графика в сессию."""
    await add_and_flush(db, table)
    return table


async def get_mass_fraction_refraction_entries(
    db: AsyncSession, research_method_id: int
) -> list[MassFractionOilRefractionTable]:
    """Получить точки градуировочного графика для метода."""
    result = await db.execute(
        filter_not_deleted(
            select(MassFractionOilRefractionTable)
            .where(MassFractionOilRefractionTable.research_method_id == research_method_id)
            .order_by(cast(MassFractionOilRefractionTable.c_value, Float)),
            MassFractionOilRefractionTable.deleted_at,
        )
    )
    return list(result.scalars().all())
