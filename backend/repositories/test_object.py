from __future__ import annotations
from typing import Optional
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from models.laboratory import Department, Laboratory
from models.test_object import TestObject
from repositories.base import (
    add_and_flush,
    execute_scalar_one_or_none,
    execute_scalars_all,
    filter_not_deleted,
    refresh_entity,
)
from utils.sorting import build_order_by


async def get_test_object_tags(db: AsyncSession) -> set[str]:
    """Получить теги из справочника объектов испытаний."""
    result = await db.execute(
        select(TestObject.tag).where(TestObject.deleted_at.is_(None)).distinct()
    )
    return {row[0] for row in result.all() if row[0]}


async def get_test_object_by_id(
    db: AsyncSession,
    test_object_id: int,
    include_deleted: bool = False,
) -> Optional[TestObject]:
    """Получить объект испытаний по ID."""
    query = select(TestObject).where(TestObject.id == test_object_id)
    if not include_deleted:
        query = filter_not_deleted(query, TestObject.deleted_at)
    return await execute_scalar_one_or_none(db, query)


async def get_test_objects(
    db: AsyncSession,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> list[TestObject]:
    """Получить список объектов испытаний без пагинации."""
    query = filter_not_deleted(select(TestObject), TestObject.deleted_at)

    if search:
        query = query.where(
            or_(
                TestObject.name.ilike(f"%{search}%"),
                TestObject.tag.ilike(f"%{search}%"),
            )
        )

    sort_mapping = {
        "name": TestObject.name,
        "tag": TestObject.tag,
        "created_at": TestObject.created_at,
        "updated_at": TestObject.updated_at,
    }
    order_by = build_order_by(
        sort_by,
        sort_order,
        sort_mapping,
        TestObject.id,
        default_order="asc",
    )
    query = query.order_by(order_by)

    return await execute_scalars_all(db, query)


async def resolve_tag_by_name(
    db: AsyncSession,
    test_object_name: str,
) -> Optional[str]:
    """Найти тег справочника по наименованию объекта испытаний."""
    query = (
        select(TestObject.tag)
        .where(
            TestObject.deleted_at.is_(None),
            func.lower(TestObject.name) == test_object_name.strip().lower(),
        )
        .limit(1)
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def exists_test_object_by_name(
    db: AsyncSession,
    name: str,
    exclude_id: Optional[int] = None,
) -> bool:
    """Проверить существование объекта испытаний с таким наименованием."""
    conditions = [
        func.lower(TestObject.name) == name.lower(),
        TestObject.deleted_at.is_(None),
    ]
    if exclude_id is not None:
        conditions.append(TestObject.id != exclude_id)

    query = select(TestObject).where(*conditions)
    existing = await execute_scalar_one_or_none(db, query)
    return existing is not None


async def add_test_object(db: AsyncSession, item: TestObject) -> TestObject:
    """Добавить объект испытаний в сессию и выполнить flush."""
    await add_and_flush(db, item)
    await refresh_entity(db, item)
    return item


async def get_laboratories_for_visibility_scope(
    db: AsyncSession,
    laboratory_ids: list[int],
) -> list[tuple[int, str]]:
    """Получить id и названия лабораторий для области видимости."""
    if not laboratory_ids:
        return []

    lab_result = await db.execute(
        select(Laboratory.id, Laboratory.name).where(
            Laboratory.id.in_(laboratory_ids),
            Laboratory.deleted_at.is_(None),
        )
    )
    return [(row[0], row[1]) for row in lab_result.all()]


async def get_departments_for_visibility_scope(
    db: AsyncSession,
    department_ids: list[int],
) -> list[tuple[int, str, str, str | None]]:
    """Получить подразделения с названиями лабораторий для области видимости."""
    if not department_ids:
        return []

    dept_result = await db.execute(
        select(Department.id, Department.name, Laboratory.name, Laboratory.full_name)
        .join(Laboratory, Department.laboratory_id == Laboratory.id)
        .where(
            Department.id.in_(department_ids),
            Department.deleted_at.is_(None),
            Laboratory.deleted_at.is_(None),
        )
    )
    return [(row[0], row[1], row[2], row[3]) for row in dept_result.all()]
