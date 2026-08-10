from __future__ import annotations
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
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
    result = await db.execute(filter_not_deleted(select(TestObject.tag), TestObject.deleted_at).distinct())
    return {row[0] for row in result.all() if row[0]}


async def get_test_object_by_id(
    db: AsyncSession,
    test_object_id: int,
    include_deleted: bool = False,
) -> TestObject | None:
    """Получить объект испытаний по ID."""
    query = select(TestObject).where(TestObject.id == test_object_id)
    if not include_deleted:
        query = filter_not_deleted(query, TestObject.deleted_at)
    return await execute_scalar_one_or_none(db, query)


async def get_test_objects(
    db: AsyncSession,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
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
) -> str | None:
    """Найти тег справочника по наименованию объекта испытаний."""
    query = filter_not_deleted(
        select(TestObject.tag).where(
            func.lower(TestObject.name) == test_object_name.strip().lower(),
        ),
        TestObject.deleted_at,
    ).limit(1)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_protocol_abbreviations_by_names(
    db: AsyncSession,
    names: list[str],
) -> dict[str, str]:
    """Аббревиатуры протокола по наименованиям."""
    normalized = sorted({name.strip().lower() for name in names if name and str(name).strip()})
    if not normalized:
        return {}

    query = filter_not_deleted(select(TestObject.name, TestObject.protocol_abbreviation), TestObject.deleted_at).where(
        func.lower(TestObject.name).in_(normalized),
        TestObject.protocol_abbreviation.is_not(None),
    )
    result = await db.execute(query)
    abbreviations: dict[str, str] = {}
    for name, abbreviation in result.all():
        if not abbreviation:
            continue
        abbreviations[name.strip().lower()] = abbreviation.strip()
    return abbreviations


async def exists_test_object_by_name(
    db: AsyncSession,
    name: str,
    exclude_id: int | None = None,
) -> bool:
    """Проверить существование объекта испытаний с таким наименованием."""
    query = filter_not_deleted(
        select(TestObject).where(func.lower(TestObject.name) == name.lower()),
        TestObject.deleted_at,
    )
    if exclude_id is not None:
        query = query.where(TestObject.id != exclude_id)

    existing = await execute_scalar_one_or_none(db, query)
    return existing is not None


async def add_test_object(db: AsyncSession, item: TestObject) -> TestObject:
    """Добавить объект испытаний в сессию и выполнить flush."""
    await add_and_flush(db, item)
    await refresh_entity(db, item)
    return item
