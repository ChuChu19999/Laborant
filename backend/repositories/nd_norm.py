from __future__ import annotations
from typing import List, Optional
import pendulum
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.nd_norm import NdNorm
from models.research import ResearchMethod
from repositories.base import (
    add_and_flush,
    execute_scalar_one_or_none,
    execute_scalars_all,
    filter_not_deleted,
)
from utils.filters import add_date_range_filter
from utils.pagination import apply_pagination, get_total_count
from utils.sorting import build_order_by


async def get_nd_norm_by_id(
    db: AsyncSession,
    nd_norm_id: int,
    include_deleted: bool = False,
) -> Optional[NdNorm]:
    """Получить норму НД по ID."""
    query = (
        select(NdNorm)
        .where(NdNorm.id == nd_norm_id)
        .options(selectinload(NdNorm.laboratory), selectinload(NdNorm.department))
    )
    if not include_deleted:
        query = filter_not_deleted(query, NdNorm.deleted_at)
    return await execute_scalar_one_or_none(db, query)


async def get_nd_norms(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    search: Optional[str] = None,
    test_object: Optional[str] = None,
    test_objects: Optional[List[str]] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
    created_at_from: Optional[pendulum.DateTime] = None,
    created_at_to: Optional[pendulum.DateTime] = None,
) -> tuple[List[NdNorm], int]:
    """Получить список норм НД."""
    query = filter_not_deleted(select(NdNorm), NdNorm.deleted_at).options(
        selectinload(NdNorm.laboratory), selectinload(NdNorm.department)
    )

    conditions = []
    if laboratory_id:
        conditions.append(NdNorm.laboratory_id == laboratory_id)
    if department_id:
        conditions.append(NdNorm.department_id == department_id)
    if search:
        conditions.append(NdNorm.name.ilike(f"%{search}%"))
    if test_objects:
        conditions.append(NdNorm.test_object.in_(test_objects))
    elif test_object:
        conditions.append(NdNorm.test_object == test_object)
    add_date_range_filter(conditions, created_at_from, created_at_to, NdNorm.created_at)
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "name": NdNorm.name,
        "test_object": NdNorm.test_object,
        "created_at": NdNorm.created_at,
        "updated_at": NdNorm.updated_at,
    }
    order_by = build_order_by(sort_by, sort_order, sort_mapping, NdNorm.name)
    query = query.order_by(order_by)

    count_query = (
        select(func.count()).select_from(NdNorm).where(NdNorm.deleted_at.is_(None))
    )
    count_conditions = []
    if laboratory_id:
        count_conditions.append(NdNorm.laboratory_id == laboratory_id)
    if department_id:
        count_conditions.append(NdNorm.department_id == department_id)
    if search:
        count_conditions.append(NdNorm.name.ilike(f"%{search}%"))
    if test_objects:
        count_conditions.append(NdNorm.test_object.in_(test_objects))
    elif test_object:
        count_conditions.append(NdNorm.test_object == test_object)
    add_date_range_filter(
        count_conditions, created_at_from, created_at_to, NdNorm.created_at
    )
    if count_conditions:
        count_query = count_query.where(*count_conditions)

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        query = apply_pagination(query, page, page_size)

    items = await execute_scalars_all(db, query)
    return items, total


async def get_valid_method_ids(
    db: AsyncSession,
    method_ids: set[int],
    laboratory_id: int,
    department_id: Optional[int],
) -> set[int]:
    """Получить ID методов исследования, существующих в лаборатории."""
    query = select(ResearchMethod.id).where(
        ResearchMethod.id.in_(method_ids),
        ResearchMethod.deleted_at.is_(None),
        ResearchMethod.laboratory_id == laboratory_id,
    )
    if department_id:
        query = query.where(ResearchMethod.department_id == department_id)

    result = await db.execute(query)
    return {row[0] for row in result.all()}


async def add_nd_norm(db: AsyncSession, nd_norm: NdNorm) -> NdNorm:
    """Добавить норму НД в сессию."""
    await add_and_flush(db, nd_norm)
    return nd_norm
