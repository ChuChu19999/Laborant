from __future__ import annotations
from sqlalchemy import ColumnElement, delete, func, insert, or_, select
from sqlalchemy.dialects.postgresql import JSONB
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
    filter_not_deleted_unless,
)
from utils.pagination import apply_pagination, get_total_count
from utils.sorting import build_order_by


def _build_research_method_conditions(
    *,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    search: str | None = None,
    rounding_type: str | None = None,
) -> list[ColumnElement[bool]]:
    """Собрать условия фильтрации методов исследования."""
    conditions: list[ColumnElement[bool]] = []
    if laboratory_id:
        conditions.append(ResearchMethod.laboratory_id == laboratory_id)
    if department_id:
        conditions.append(ResearchMethod.department_id == department_id)
    if rounding_type:
        conditions.append(ResearchMethod.rounding_type == rounding_type)
    if search:
        conditions.append(
            or_(
                ResearchMethod.name.ilike(f"%{search}%"),
                ResearchMethod.nd_code.ilike(f"%{search}%"),
                ResearchMethod.nd_name.ilike(f"%{search}%"),
            )
        )
    return conditions


def _build_research_method_group_conditions(
    *,
    search: str | None = None,
) -> list[ColumnElement[bool]]:
    """Собрать условия фильтрации групп методов исследования."""
    conditions: list[ColumnElement[bool]] = []
    if search:
        conditions.append(ResearchMethodGroup.name.ilike(f"%{search}%"))
    return conditions


async def get_research_method_by_id(
    db: AsyncSession, method_id: int, include_deleted: bool = False
) -> ResearchMethod | None:
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
    query = filter_not_deleted_unless(query, ResearchMethod.deleted_at, include_deleted)
    return await execute_scalar_one_or_none(db, query)


async def get_active_research_methods_by_name(
    db: AsyncSession,
    name: str,
    laboratory_id: int,
    department_id: int | None = None,
    group_name: str | None = None,
) -> list[ResearchMethod]:
    """Найти актуальные методики по имени в лаборатории и подразделении."""
    query = filter_not_deleted(
        select(ResearchMethod).where(
            ResearchMethod.name == name,
            ResearchMethod.laboratory_id == laboratory_id,
        ),
        ResearchMethod.deleted_at,
    )
    if department_id is not None:
        query = query.where(ResearchMethod.department_id == department_id)
    else:
        query = query.where(ResearchMethod.department_id.is_(None))
    if group_name is not None:
        query = (
            query.join(
                research_method_groups_association,
                ResearchMethod.id == research_method_groups_association.c.research_method_id,
            )
            .join(
                ResearchMethodGroup,
                ResearchMethodGroup.id == research_method_groups_association.c.research_method_group_id,
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
    laboratory_id: int | None = None,
    department_id: int | None = None,
    page: int | None = None,
    page_size: int | None = None,
    search: str | None = None,
    rounding_type: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
    *,
    load_relations: bool = True,
) -> tuple[list[ResearchMethod], int]:
    """Получить список методов исследования."""
    query = filter_not_deleted(select(ResearchMethod), ResearchMethod.deleted_at)
    if load_relations:
        query = query.options(
            selectinload(ResearchMethod.laboratory),
            selectinload(ResearchMethod.department),
            selectinload(ResearchMethod.groups),
        )

    conditions = _build_research_method_conditions(
        laboratory_id=laboratory_id,
        department_id=department_id,
        search=search,
        rounding_type=rounding_type,
    )
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "name": ResearchMethod.name,
        "sort_order": ResearchMethod.sort_order,
        "created_at": ResearchMethod.created_at,
    }
    order_by = build_order_by(sort_by, sort_order, sort_mapping, ResearchMethod.name)
    query = query.order_by(order_by)

    count_query = filter_not_deleted(
        select(func.count()).select_from(ResearchMethod),
        ResearchMethod.deleted_at,
    )
    if conditions:
        count_query = count_query.where(*conditions)

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        query = apply_pagination(query, page, page_size)

    methods = await execute_scalars_all(db, query)
    return methods, total


async def get_max_sort_order(db: AsyncSession) -> int:
    """Получить максимальный sort_order среди методов и групп."""
    max_method = await execute_scalar_one_or_none(
        db,
        filter_not_deleted(
            select(func.max(ResearchMethod.sort_order)).where(
                ResearchMethod.is_group_member.is_(False),
            ),
            ResearchMethod.deleted_at,
        ),
    )
    max_group = await execute_scalar_one_or_none(
        db,
        filter_not_deleted(
            select(func.max(ResearchMethodGroup.sort_order)),
            ResearchMethodGroup.deleted_at,
        ),
    )
    return max(max_method or 0, max_group or 0)


async def get_research_methods_referencing_equipment(
    db: AsyncSession,
    equipment_id: int,
) -> list[ResearchMethod]:
    """Вернуть методы, у которых в equipment_data_default есть указанный прибор."""
    query = filter_not_deleted(
        select(ResearchMethod).where(func.cast(ResearchMethod.equipment_data_default, JSONB).contains([equipment_id])),
        ResearchMethod.deleted_at,
    )
    return await execute_scalars_all(db, query)


async def add_research_method(db: AsyncSession, method: ResearchMethod) -> ResearchMethod:
    """Добавить метод исследования."""
    await add_and_flush(db, method)
    return method


async def get_conflicting_method_by_sort_order(
    db: AsyncSession,
    sort_order: int,
    exclude_method_id: int | None = None,
) -> ResearchMethod | None:
    """Найти метод с конфликтующим sort_order."""
    query = filter_not_deleted(
        select(ResearchMethod).where(
            ResearchMethod.sort_order == sort_order,
            ResearchMethod.is_group_member.is_(False),
        ),
        ResearchMethod.deleted_at,
    )
    if exclude_method_id is not None:
        query = query.where(ResearchMethod.id != exclude_method_id)

    query = query.with_for_update()
    return await execute_scalar_one_or_none(db, query)


async def get_conflicting_group_by_sort_order(
    db: AsyncSession,
    sort_order: int,
    exclude_group_id: int | None = None,
) -> ResearchMethodGroup | None:
    """Найти группу с конфликтующим sort_order."""
    query = filter_not_deleted(
        select(ResearchMethodGroup).where(ResearchMethodGroup.sort_order == sort_order),
        ResearchMethodGroup.deleted_at,
    )
    if exclude_group_id is not None:
        query = query.where(ResearchMethodGroup.id != exclude_group_id)

    query = query.with_for_update()
    return await execute_scalar_one_or_none(db, query)


async def get_research_method_group_by_id(
    db: AsyncSession, group_id: int, include_deleted: bool = False
) -> ResearchMethodGroup | None:
    """Получить группу методов исследования по ID."""
    query = (
        select(ResearchMethodGroup)
        .where(ResearchMethodGroup.id == group_id)
        .options(selectinload(ResearchMethodGroup.methods))
    )
    query = filter_not_deleted_unless(query, ResearchMethodGroup.deleted_at, include_deleted)
    return await execute_scalar_one_or_none(db, query)


async def get_research_method_groups(
    db: AsyncSession,
    page: int | None = None,
    page_size: int | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[ResearchMethodGroup], int]:
    """Получить список групп методов исследования."""
    query = filter_not_deleted(select(ResearchMethodGroup), ResearchMethodGroup.deleted_at).options(
        selectinload(ResearchMethodGroup.methods)
    )

    conditions = _build_research_method_group_conditions(search=search)
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "name": ResearchMethodGroup.name,
        "sort_order": ResearchMethodGroup.sort_order,
        "created_at": ResearchMethodGroup.created_at,
    }
    order_by = build_order_by(sort_by, sort_order, sort_mapping, ResearchMethodGroup.name)
    query = query.order_by(order_by)

    count_query = filter_not_deleted(
        select(func.count()).select_from(ResearchMethodGroup),
        ResearchMethodGroup.deleted_at,
    )
    if conditions:
        count_query = count_query.where(*conditions)

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        query = apply_pagination(query, page, page_size)

    groups = await execute_scalars_all(db, query)
    return groups, total


async def get_research_methods_by_ids(
    db: AsyncSession,
    method_ids: list[int],
    include_deleted: bool = False,
) -> list[ResearchMethod]:
    """Получить методы исследования по списку ID."""
    if not method_ids:
        return []
    query = select(ResearchMethod).where(ResearchMethod.id.in_(method_ids)).options(selectinload(ResearchMethod.groups))
    query = filter_not_deleted_unless(query, ResearchMethod.deleted_at, include_deleted)
    return await execute_scalars_all(db, query)


async def get_valid_method_ids(
    db: AsyncSession,
    method_ids: set[int],
    laboratory_id: int,
    department_id: int | None,
) -> set[int]:
    """Получить ID методов исследования, существующих в лаборатории."""
    query = filter_not_deleted(
        select(ResearchMethod.id).where(
            ResearchMethod.id.in_(method_ids),
            ResearchMethod.laboratory_id == laboratory_id,
        ),
        ResearchMethod.deleted_at,
    )
    if department_id:
        query = query.where(ResearchMethod.department_id == department_id)

    return set(await execute_scalars_all(db, query))


async def add_research_method_group(db: AsyncSession, group: ResearchMethodGroup) -> ResearchMethodGroup:
    """Добавить группу методов."""
    await add_and_flush(db, group)
    return group


async def insert_method_group_associations(db: AsyncSession, group_id: int, method_ids: list[int]) -> None:
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


async def delete_method_group_associations(db: AsyncSession, group_id: int, method_ids: list[int]) -> None:
    """Удалить связи методов с группой."""
    await db.execute(
        delete(research_method_groups_association).where(
            research_method_groups_association.c.research_method_group_id == group_id,
            research_method_groups_association.c.research_method_id.in_(method_ids),
        )
    )
