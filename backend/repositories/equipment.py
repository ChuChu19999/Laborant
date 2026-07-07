from __future__ import annotations
from typing import List, Optional
import pendulum
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.equipment import Equipment
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


async def get_equipment_by_id(
    db: AsyncSession, equipment_id: int, include_deleted: bool = False
) -> Optional[Equipment]:
    """Получить оборудование по ID."""
    query = (
        select(Equipment)
        .where(Equipment.id == equipment_id)
        .options(selectinload(Equipment.laboratory), selectinload(Equipment.department))
    )
    if not include_deleted:
        query = filter_not_deleted(query, Equipment.deleted_at)
    return await execute_scalar_one_or_none(db, query)


async def get_equipment_by_ids(
    db: AsyncSession,
    equipment_ids: list[int],
    include_deleted: bool = True,
) -> dict[int, Equipment]:
    """Получить оборудование по списку ID."""
    if not equipment_ids:
        return {}

    query = (
        select(Equipment)
        .where(Equipment.id.in_(equipment_ids))
        .options(selectinload(Equipment.laboratory), selectinload(Equipment.department))
    )
    if not include_deleted:
        query = filter_not_deleted(query, Equipment.deleted_at)

    equipment_list = await execute_scalars_all(db, query)
    return {equipment.id: equipment for equipment in equipment_list}


async def get_equipment(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
    equipment_types: Optional[List[str]] = None,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
    verification_date_from: Optional[pendulum.DateTime] = None,
    verification_date_to: Optional[pendulum.DateTime] = None,
    verification_end_date_from: Optional[pendulum.DateTime] = None,
    verification_end_date_to: Optional[pendulum.DateTime] = None,
    created_at_from: Optional[pendulum.DateTime] = None,
    created_at_to: Optional[pendulum.DateTime] = None,
) -> tuple[List[Equipment], int]:
    """Получить список оборудования."""
    query = filter_not_deleted(
        select(Equipment),
        Equipment.deleted_at,
    ).options(selectinload(Equipment.laboratory), selectinload(Equipment.department))

    conditions = []
    if laboratory_id:
        conditions.append(Equipment.laboratory_id == laboratory_id)
    if department_id:
        conditions.append(Equipment.department_id == department_id)
    if equipment_types:
        conditions.append(Equipment.type.in_(equipment_types))
    if search:
        conditions.append(
            or_(
                Equipment.name.ilike(f"%{search}%"),
                Equipment.serial_number.ilike(f"%{search}%"),
            )
        )

    add_date_range_filter(
        conditions,
        verification_date_from,
        verification_date_to,
        Equipment.verification_date,
    )
    add_date_range_filter(
        conditions,
        verification_end_date_from,
        verification_end_date_to,
        Equipment.verification_end_date,
    )
    add_date_range_filter(
        conditions, created_at_from, created_at_to, Equipment.created_at
    )
    if conditions:
        query = query.where(*conditions)

    if sort_by == "type":
        type_sort = case(
            (Equipment.type == "test_equipment", "Испытательное оборудование"),
            (Equipment.type == "measuring_instrument", "Средство измерения"),
            else_=Equipment.type,
        )
        if sort_order == "asc":
            query = query.order_by(type_sort.asc())
        else:
            query = query.order_by(type_sort.desc())
    else:
        sort_mapping = {
            "name": Equipment.name,
            "serial_number": Equipment.serial_number,
            "version": Equipment.version,
            "verification_date": Equipment.verification_date,
            "verification_end_date": Equipment.verification_end_date,
            "created_at": Equipment.created_at,
        }
        order_by = build_order_by(sort_by, sort_order, sort_mapping, Equipment.name)
        query = query.order_by(order_by)

    count_query = (
        select(func.count())
        .select_from(Equipment)
        .where(Equipment.deleted_at.is_(None))
    )
    count_conditions = []
    if laboratory_id:
        count_conditions.append(Equipment.laboratory_id == laboratory_id)
    if department_id:
        count_conditions.append(Equipment.department_id == department_id)
    if equipment_types:
        count_conditions.append(Equipment.type.in_(equipment_types))
    if search:
        count_conditions.append(
            or_(
                Equipment.name.ilike(f"%{search}%"),
                Equipment.serial_number.ilike(f"%{search}%"),
            )
        )
    add_date_range_filter(
        count_conditions,
        verification_date_from,
        verification_date_to,
        Equipment.verification_date,
    )
    add_date_range_filter(
        count_conditions,
        verification_end_date_from,
        verification_end_date_to,
        Equipment.verification_end_date,
    )
    add_date_range_filter(
        count_conditions, created_at_from, created_at_to, Equipment.created_at
    )
    if count_conditions:
        count_query = count_query.where(*count_conditions)

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        query = apply_pagination(query, page, page_size)

    equipment_list = await execute_scalars_all(db, query)
    return equipment_list, total


async def get_latest_equipment_version(
    db: AsyncSession,
    name: str,
    laboratory_id: int,
    department_id: Optional[int],
) -> Optional[Equipment]:
    """Получить последнюю версию оборудования по имени."""
    latest_query = select(Equipment).where(
        Equipment.name == name,
        Equipment.laboratory_id == laboratory_id,
        Equipment.deleted_at.is_(None),
    )

    if department_id:
        latest_query = latest_query.where(Equipment.department_id == department_id)
    else:
        latest_query = latest_query.where(Equipment.department_id.is_(None))

    latest_query = latest_query.order_by(Equipment.version.desc()).limit(1)
    return await execute_scalar_one_or_none(db, latest_query)


async def add_equipment(db: AsyncSession, equipment: Equipment) -> Equipment:
    """Добавить оборудование в сессию."""
    await add_and_flush(db, equipment)
    return equipment


async def get_research_methods_for_equipment_update(
    db: AsyncSession,
    laboratory_id: int,
    department_id: Optional[int],
) -> list[ResearchMethod]:
    """Получить методы исследования для обновления при смене версии прибора."""
    methods_query = select(ResearchMethod).where(
        ResearchMethod.deleted_at.is_(None),
        ResearchMethod.laboratory_id == laboratory_id,
    )

    if department_id:
        methods_query = methods_query.where(
            ResearchMethod.department_id == department_id
        )

    return await execute_scalars_all(db, methods_query)


async def get_all_research_methods_for_equipment_removal(
    db: AsyncSession,
) -> list[ResearchMethod]:
    """Получить все неудалённые методы исследования."""
    methods_query = select(ResearchMethod).where(ResearchMethod.deleted_at.is_(None))
    return await execute_scalars_all(db, methods_query)
