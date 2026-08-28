from __future__ import annotations
from sqlalchemy import ColumnElement, and_, cast, func, or_, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from models.test_object import TestObject
from repositories.base import (
    add_and_flush,
    execute_exists,
    execute_scalar_one_or_none,
    execute_scalars_all,
    filter_not_deleted,
    filter_not_deleted_unless,
    refresh_entity,
)
from utils.pagination import apply_pagination, get_total_count
from utils.sorting import build_order_by


def _build_visibility_scope_sql_predicate(
    laboratory_id: int | None,
    department_id: int | None,
) -> ColumnElement[bool]:
    """SQL-предикат видимости объекта по лаборатории/подразделению.

    Этот хелпер переводит параметры видимости (из service) в SQL-условие для JSONB-поля
    `visibility_scope`. Решение о том, учитывать видимость или нет, остаётся в service.
    """
    scope = cast(TestObject.visibility_scope, JSONB)
    lab_ids = cast(scope["laboratory_ids"], JSONB)
    dept_ids = cast(scope["department_ids"], JSONB)

    empty_scope = and_(
        func.coalesce(func.jsonb_array_length(lab_ids), 0) == 0,
        func.coalesce(func.jsonb_array_length(dept_ids), 0) == 0,
    )

    parts: list[ColumnElement[bool]] = [empty_scope]
    if department_id is not None:
        parts.append(scope.contains({"department_ids": [department_id]}))
    if laboratory_id is not None:
        parts.append(scope.contains({"laboratory_ids": [laboratory_id]}))
    return or_(*parts)


async def get_test_object_tags(db: AsyncSession) -> set[str]:
    """Получить теги из справочника объектов испытаний."""
    tags = await execute_scalars_all(
        db,
        filter_not_deleted(select(TestObject.tag), TestObject.deleted_at).distinct(),
    )
    return {tag for tag in tags if tag}


async def get_test_object_by_id(
    db: AsyncSession,
    test_object_id: int,
    include_deleted: bool = False,
) -> TestObject | None:
    """Получить объект испытаний по ID."""
    query = select(TestObject).where(TestObject.id == test_object_id)
    query = filter_not_deleted_unless(query, TestObject.deleted_at, include_deleted)
    return await execute_scalar_one_or_none(db, query)


async def get_test_objects(
    db: AsyncSession,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
    page: int | None = None,
    page_size: int | None = None,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    *,
    apply_visibility_filter: bool = False,
) -> tuple[list[TestObject], int]:
    """Получить список объектов испытаний из справочника."""
    query = filter_not_deleted(select(TestObject), TestObject.deleted_at)
    conditions: list[ColumnElement[bool]] = []

    if search:
        conditions.append(
            or_(
                TestObject.name.ilike(f"%{search}%"),
                TestObject.tag.ilike(f"%{search}%"),
            )
        )

    if apply_visibility_filter:
        conditions.append(_build_visibility_scope_sql_predicate(laboratory_id, department_id))

    if conditions:
        query = query.where(*conditions)

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

    count_query = filter_not_deleted(
        select(func.count()).select_from(TestObject),
        TestObject.deleted_at,
    )
    if conditions:
        count_query = count_query.where(*conditions)
    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        query = apply_pagination(query, page, page_size)

    items = await execute_scalars_all(db, query)
    return items, total


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
    return await execute_scalar_one_or_none(db, query)


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
        select(TestObject.id).where(func.lower(TestObject.name) == name.lower()),
        TestObject.deleted_at,
    )
    if exclude_id is not None:
        query = query.where(TestObject.id != exclude_id)
    return await execute_exists(db, query)


async def add_test_object(db: AsyncSession, item: TestObject) -> TestObject:
    """Добавить объект испытаний.

    Refresh после INSERT: подтянуть created_at и updated_at, которые выставляет БД.
    """
    await add_and_flush(db, item)
    await refresh_entity(db, item)
    return item
