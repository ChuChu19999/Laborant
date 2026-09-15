from __future__ import annotations
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.test_purpose import TestPurpose
from repositories.base import (
    add_and_flush,
    execute_exists,
    execute_scalar_one_or_none,
    execute_scalars_all,
    filter_not_deleted,
    filter_not_deleted_unless,
)
from utils.filters import add_text_search_filter
from utils.sorting import build_order_by, natural_name_reverse, sort_by_natural_name


def _test_purpose_load_options():
    return (
        selectinload(TestPurpose.laboratory),
        selectinload(TestPurpose.department),
    )


async def get_test_purpose_by_id(
    db: AsyncSession, test_purpose_id: int, include_deleted: bool = False
) -> TestPurpose | None:
    """Получить цель испытаний по ID."""
    query = select(TestPurpose).options(*_test_purpose_load_options()).where(TestPurpose.id == test_purpose_id)
    query = filter_not_deleted_unless(query, TestPurpose.deleted_at, include_deleted)
    return await execute_scalar_one_or_none(db, query)


async def get_test_purposes(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> list[TestPurpose]:
    """Получить список целей испытаний."""
    query = filter_not_deleted(select(TestPurpose).options(*_test_purpose_load_options()), TestPurpose.deleted_at)

    conditions = []
    if laboratory_id:
        conditions.append(TestPurpose.laboratory_id == laboratory_id)
    if department_id:
        conditions.append(TestPurpose.department_id == department_id)
    if search:
        add_text_search_filter(conditions, search, TestPurpose.name)
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "name": TestPurpose.name,
        "created_at": TestPurpose.created_at,
    }
    order_by = build_order_by(sort_by, sort_order, sort_mapping, TestPurpose.name)
    query = query.order_by(order_by)

    items = await execute_scalars_all(db, query)
    natural_reverse = natural_name_reverse(sort_by, sort_order, default_order="asc")
    if natural_reverse is not None:
        items = sort_by_natural_name(items, name_getter=lambda item: item.name, reverse=natural_reverse)
    return items


async def exists_test_purpose_by_name(
    db: AsyncSession,
    name: str,
    laboratory_id: int,
    department_id: int | None,
    exclude_id: int | None = None,
) -> bool:
    """Проверить существование цели испытаний с таким названием в scope."""
    query = filter_not_deleted(
        select(TestPurpose.id).where(
            TestPurpose.name == name.strip(),
            TestPurpose.laboratory_id == laboratory_id,
        ),
        TestPurpose.deleted_at,
    )
    if department_id is not None:
        query = query.where(TestPurpose.department_id == department_id)
    else:
        query = query.where(TestPurpose.department_id.is_(None))
    if exclude_id is not None:
        query = query.where(TestPurpose.id != exclude_id)
    return await execute_exists(db, query)


async def add_test_purpose(db: AsyncSession, test_purpose: TestPurpose) -> TestPurpose:
    """Добавить цель испытаний."""
    await add_and_flush(db, test_purpose)
    return test_purpose
