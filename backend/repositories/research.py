from __future__ import annotations
from typing import List, Optional
from sqlalchemy import delete, func, insert, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.research import (
    ResearchMethod,
    ResearchMethodGroup,
    research_method_groups_association,
)
from repositories.base import (
    add_and_flush,
    execute_scalar_one_or_none,
    execute_scalars_all,
    filter_not_deleted,
)
from utils.pagination import apply_pagination, get_total_count
from utils.sorting import build_order_by


async def get_research_method_by_id(
    db: AsyncSession, method_id: int, include_deleted: bool = False
) -> Optional[ResearchMethod]:
    """Получить метод исследования по ID."""
    query = (
        select(ResearchMethod)
        .where(ResearchMethod.id == method_id)
        .options(
            selectinload(ResearchMethod.laboratory),
            selectinload(ResearchMethod.department),
            selectinload(ResearchMethod.groups),
        )
    )
    if not include_deleted:
        query = filter_not_deleted(query, ResearchMethod.deleted_at)
    return await execute_scalar_one_or_none(db, query)


async def get_active_research_methods_by_name(
    db: AsyncSession,
    name: str,
    laboratory_id: int,
    department_id: Optional[int] = None,
    group_name: Optional[str] = None,
) -> List[ResearchMethod]:
    """Найти актуальные методики по имени в лаборатории и подразделении."""
    conditions = [
        ResearchMethod.name == name,
        ResearchMethod.laboratory_id == laboratory_id,
        ResearchMethod.deleted_at.is_(None),
    ]
    if department_id is not None:
        conditions.append(ResearchMethod.department_id == department_id)
    else:
        conditions.append(ResearchMethod.department_id.is_(None))

    query = select(ResearchMethod).where(*conditions)
    if group_name is not None:
        query = (
            query.join(
                research_method_groups_association,
                ResearchMethod.id
                == research_method_groups_association.c.research_method_id,
            )
            .join(
                ResearchMethodGroup,
                ResearchMethodGroup.id
                == research_method_groups_association.c.research_method_group_id,
            )
            .where(ResearchMethodGroup.name == group_name)
        )

    query = query.options(
        selectinload(ResearchMethod.laboratory),
        selectinload(ResearchMethod.department),
        selectinload(ResearchMethod.groups),
    )
    result = await db.execute(query)
    return list(result.scalars().unique().all())


async def get_research_methods(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    search: Optional[str] = None,
    rounding_type: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[List[ResearchMethod], int]:
    """Получить список методов исследования."""
    query = (
        select(ResearchMethod)
        .where(ResearchMethod.deleted_at.is_(None))
        .options(
            selectinload(ResearchMethod.laboratory),
            selectinload(ResearchMethod.department),
            selectinload(ResearchMethod.groups),
        )
    )

    conditions = []
    if laboratory_id:
        conditions.append(ResearchMethod.laboratory_id == laboratory_id)
    if department_id:
        conditions.append(ResearchMethod.department_id == department_id)
    if rounding_type:
        conditions.append(ResearchMethod.rounding_type == rounding_type)
    if conditions:
        query = query.where(*conditions)

    if search:
        query = query.where(
            or_(
                ResearchMethod.name.ilike(f"%{search}%"),
                ResearchMethod.nd_code.ilike(f"%{search}%"),
                ResearchMethod.nd_name.ilike(f"%{search}%"),
            )
        )

    sort_mapping = {
        "name": ResearchMethod.name,
        "sort_order": ResearchMethod.sort_order,
        "created_at": ResearchMethod.created_at,
    }
    order_by = build_order_by(sort_by, sort_order, sort_mapping, ResearchMethod.name)
    query = query.order_by(order_by)

    count_query = (
        select(func.count())
        .select_from(ResearchMethod)
        .where(ResearchMethod.deleted_at.is_(None))
    )
    count_conditions = []
    if laboratory_id:
        count_conditions.append(ResearchMethod.laboratory_id == laboratory_id)
    if department_id:
        count_conditions.append(ResearchMethod.department_id == department_id)
    if rounding_type:
        count_conditions.append(ResearchMethod.rounding_type == rounding_type)
    if count_conditions:
        count_query = count_query.where(*count_conditions)
    if search:
        count_query = count_query.where(
            or_(
                ResearchMethod.name.ilike(f"%{search}%"),
                ResearchMethod.nd_code.ilike(f"%{search}%"),
                ResearchMethod.nd_name.ilike(f"%{search}%"),
            )
        )

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        query = apply_pagination(query, page, page_size)

    methods = await execute_scalars_all(db, query)
    return methods, total


async def get_max_sort_order(db: AsyncSession) -> int:
    """Получить максимальный sort_order среди методов и групп."""
    max_method_sort_order = await db.execute(
        select(func.max(ResearchMethod.sort_order)).where(
            ResearchMethod.deleted_at.is_(None),
            ResearchMethod.is_group_member == False,
        )
    )
    max_group_sort_order = await db.execute(
        select(func.max(ResearchMethodGroup.sort_order)).where(
            ResearchMethodGroup.deleted_at.is_(None)
        )
    )
    max_method = max_method_sort_order.scalar() or 0
    max_group = max_group_sort_order.scalar() or 0
    return max(max_method, max_group)


async def add_research_method(
    db: AsyncSession, method: ResearchMethod
) -> ResearchMethod:
    """Добавить метод исследования в сессию."""
    await add_and_flush(db, method)
    return method


async def get_conflicting_method_by_sort_order(
    db: AsyncSession,
    sort_order: int,
    exclude_method_id: Optional[int] = None,
) -> Optional[ResearchMethod]:
    """Найти метод с конфликтующим sort_order."""
    method_conditions = [
        ResearchMethod.sort_order == sort_order,
        ResearchMethod.deleted_at.is_(None),
        ResearchMethod.is_group_member == False,
    ]
    if exclude_method_id is not None:
        method_conditions.append(ResearchMethod.id != exclude_method_id)

    query = select(ResearchMethod).where(*method_conditions).with_for_update()
    return await execute_scalar_one_or_none(db, query)


async def get_conflicting_group_by_sort_order(
    db: AsyncSession,
    sort_order: int,
    exclude_group_id: Optional[int] = None,
) -> Optional[ResearchMethodGroup]:
    """Найти группу с конфликтующим sort_order."""
    group_conditions = [
        ResearchMethodGroup.sort_order == sort_order,
        ResearchMethodGroup.deleted_at.is_(None),
    ]
    if exclude_group_id is not None:
        group_conditions.append(ResearchMethodGroup.id != exclude_group_id)

    query = select(ResearchMethodGroup).where(*group_conditions).with_for_update()
    return await execute_scalar_one_or_none(db, query)


async def get_research_method_group_by_id(
    db: AsyncSession, group_id: int, include_deleted: bool = False
) -> Optional[ResearchMethodGroup]:
    """Получить группу методов исследования по ID."""
    query = (
        select(ResearchMethodGroup)
        .where(ResearchMethodGroup.id == group_id)
        .options(selectinload(ResearchMethodGroup.methods))
    )
    if not include_deleted:
        query = filter_not_deleted(query, ResearchMethodGroup.deleted_at)
    return await execute_scalar_one_or_none(db, query)


async def get_research_method_groups(
    db: AsyncSession,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[List[ResearchMethodGroup], int]:
    """Получить список групп методов исследования."""
    query = (
        select(ResearchMethodGroup)
        .where(ResearchMethodGroup.deleted_at.is_(None))
        .options(selectinload(ResearchMethodGroup.methods))
    )

    if search:
        query = query.where(ResearchMethodGroup.name.ilike(f"%{search}%"))

    sort_mapping = {
        "name": ResearchMethodGroup.name,
        "sort_order": ResearchMethodGroup.sort_order,
        "created_at": ResearchMethodGroup.created_at,
    }
    order_by = build_order_by(
        sort_by, sort_order, sort_mapping, ResearchMethodGroup.name
    )
    query = query.order_by(order_by)

    count_query = (
        select(func.count())
        .select_from(ResearchMethodGroup)
        .where(ResearchMethodGroup.deleted_at.is_(None))
    )
    if search:
        count_query = count_query.where(ResearchMethodGroup.name.ilike(f"%{search}%"))

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        query = apply_pagination(query, page, page_size)

    groups = await execute_scalars_all(db, query)
    return groups, total


async def get_research_methods_by_ids(
    db: AsyncSession, method_ids: list[int]
) -> list[ResearchMethod]:
    """Получить методы исследования по списку ID."""
    query = (
        select(ResearchMethod)
        .where(
            ResearchMethod.id.in_(method_ids),
            ResearchMethod.deleted_at.is_(None),
        )
        .options(selectinload(ResearchMethod.groups))
    )
    return await execute_scalars_all(db, query)


async def get_research_methods_by_ids_any(
    db: AsyncSession, method_ids: list[int]
) -> list[ResearchMethod]:
    """Получить методы исследования по списку ID без фильтра deleted."""
    if not method_ids:
        return []
    query = (
        select(ResearchMethod)
        .where(ResearchMethod.id.in_(method_ids))
        .options(selectinload(ResearchMethod.groups))
    )
    return await execute_scalars_all(db, query)


async def add_research_method_group(
    db: AsyncSession, group: ResearchMethodGroup
) -> ResearchMethodGroup:
    """Добавить группу методов в сессию."""
    await add_and_flush(db, group)
    return group


async def insert_method_group_associations(
    db: AsyncSession, group_id: int, method_ids: list[int]
) -> None:
    """Добавить связи методов с группой."""
    await db.execute(
        insert(research_method_groups_association).values(
            [
                {
                    "research_method_id": method_id,
                    "research_method_group_id": group_id,
                }
                for method_id in method_ids
            ]
        )
    )


async def delete_method_group_associations(
    db: AsyncSession, group_id: int, method_ids: list[int]
) -> None:
    """Удалить связи методов с группой."""
    await db.execute(
        delete(research_method_groups_association).where(
            research_method_groups_association.c.research_method_group_id == group_id,
            research_method_groups_association.c.research_method_id.in_(method_ids),
        )
    )


async def get_all_active_research_method_groups(
    db: AsyncSession,
) -> list[ResearchMethodGroup]:
    """Получить все активные группы методов исследования."""
    query = select(ResearchMethodGroup).where(ResearchMethodGroup.deleted_at.is_(None))
    return await execute_scalars_all(db, query)


async def get_research_methods_for_select(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
) -> list[ResearchMethod]:
    """Получить методы исследования для селекта."""
    query = (
        select(ResearchMethod)
        .where(ResearchMethod.deleted_at.is_(None))
        .options(
            selectinload(ResearchMethod.laboratory),
            selectinload(ResearchMethod.department),
            selectinload(ResearchMethod.groups),
        )
    )
    if laboratory_id:
        query = query.where(ResearchMethod.laboratory_id == laboratory_id)
    if department_id:
        query = query.where(ResearchMethod.department_id == department_id)

    return await execute_scalars_all(db, query)


async def get_all_active_research_methods_for_tree(
    db: AsyncSession,
) -> list[ResearchMethod]:
    """Все активные методики с лабораторией, подразделением и группами."""
    query = (
        select(ResearchMethod)
        .where(ResearchMethod.deleted_at.is_(None))
        .options(
            selectinload(ResearchMethod.laboratory),
            selectinload(ResearchMethod.department),
            selectinload(ResearchMethod.groups),
        )
    )
    return await execute_scalars_all(db, query)
