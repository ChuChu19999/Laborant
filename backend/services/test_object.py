from typing import List, Optional, Tuple
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import ConflictError, NotFoundError
from models.laboratory import Department, Laboratory
from models.test_object import TestObject
from schemas.test_object import (
    TestObjectCreate,
    TestObjectUpdate,
    visibility_scope_to_dict,
)
from utils.pagination import calculate_total_pages
from utils.sorting import build_order_by
from utils.test_object_visibility import (
    is_visible_in_scope,
    normalize_visibility_scope,
)


def _serialize_test_object(item: TestObject) -> TestObject:
    item.visibility_scope = normalize_visibility_scope(item.visibility_scope)
    return item


async def get_test_object_by_id(
    db: AsyncSession,
    test_object_id: int,
    include_deleted: bool = False,
) -> Optional[TestObject]:
    """Получить объект испытаний по ID."""
    query = select(TestObject).where(TestObject.id == test_object_id)
    if not include_deleted:
        query = query.where(TestObject.deleted_at.is_(None))
    result = await db.execute(query)
    item = result.scalar_one_or_none()
    if item:
        return _serialize_test_object(item)
    return None


async def get_test_objects_list(
    db: AsyncSession,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
    for_select: bool = False,
) -> Tuple[List[TestObject], int, int]:
    """Получить список объектов испытаний из справочника."""
    query = select(TestObject).where(TestObject.deleted_at.is_(None))

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
    # Для справочника объектов испытаний по умолчанию сортируем по id (по возрастанию),
    # чтобы порядок элементов был стабильным во всех селектах/фильтрах/листингах.
    order_by = build_order_by(
        sort_by,
        sort_order,
        sort_mapping,
        TestObject.id,
        default_order="asc",
    )
    query = query.order_by(order_by)

    result = await db.execute(query)
    items = [_serialize_test_object(item) for item in result.scalars().all()]

    if for_select or laboratory_id or department_id:
        items = [
            item
            for item in items
            if is_visible_in_scope(
                item.visibility_scope,
                laboratory_id=laboratory_id,
                department_id=department_id,
            )
        ]

    total = len(items)

    if page is not None and page_size is not None:
        offset = (page - 1) * page_size
        items = items[offset : offset + page_size]

    if page_size:
        total_pages = calculate_total_pages(total, page_size)
    else:
        total_pages = 1 if total > 0 else 0
    return items, total, total_pages


async def get_test_object_names(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
) -> List[str]:
    """Получить наименования объектов испытаний для селектов."""
    items, _, _ = await get_test_objects_list(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        for_select=True,
    )
    return [item.name for item in items]


async def resolve_tag_by_name(
    db: AsyncSession,
    test_object_name: Optional[str],
) -> Optional[str]:
    """Найти тег справочника по наименованию объекта испытаний."""
    if not test_object_name or not test_object_name.strip():
        return None

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


async def create_test_object(
    db: AsyncSession,
    data: TestObjectCreate,
) -> TestObject:
    """Создать объект испытаний в справочнике."""
    existing = await db.execute(
        select(TestObject).where(
            func.lower(TestObject.name) == data.name.lower(),
            TestObject.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictError("Объект испытаний с таким наименованием уже существует")

    item = TestObject(
        name=data.name,
        tag=data.tag,
        visibility_scope=visibility_scope_to_dict(data.visibility_scope),
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return _serialize_test_object(item)


async def update_test_object(
    db: AsyncSession,
    test_object_id: int,
    data: TestObjectUpdate,
) -> TestObject:
    """Обновить объект испытаний в справочнике."""
    item = await get_test_object_by_id(db, test_object_id)
    if not item:
        raise NotFoundError("Объект испытаний не найден")

    if data.name is not None and data.name.lower() != item.name.lower():
        existing = await db.execute(
            select(TestObject).where(
                func.lower(TestObject.name) == data.name.lower(),
                TestObject.deleted_at.is_(None),
                TestObject.id != test_object_id,
            )
        )
        if existing.scalar_one_or_none():
            raise ConflictError("Объект испытаний с таким наименованием уже существует")
        item.name = data.name

    if data.tag is not None:
        item.tag = data.tag

    if data.visibility_scope is not None:
        item.visibility_scope = visibility_scope_to_dict(data.visibility_scope)

    await db.flush()
    await db.refresh(item)
    return _serialize_test_object(item)


async def delete_test_object(db: AsyncSession, test_object_id: int) -> None:
    """Мягко удалить объект испытаний из справочника."""
    item = await get_test_object_by_id(db, test_object_id)
    if not item:
        raise NotFoundError("Объект испытаний не найден")
    item.soft_delete()
    await db.flush()


async def enrich_visibility_scope_labels(
    db: AsyncSession,
    visibility_scope: dict,
) -> dict:
    """Добавить названия лабораторий и подразделений для отображения в таблице."""
    scope = normalize_visibility_scope(visibility_scope)
    laboratory_ids = scope["laboratory_ids"]
    department_ids = scope["department_ids"]

    laboratories: List[dict] = []
    departments: List[dict] = []

    if laboratory_ids:
        lab_result = await db.execute(
            select(Laboratory.id, Laboratory.name).where(
                Laboratory.id.in_(laboratory_ids),
                Laboratory.deleted_at.is_(None),
            )
        )
        laboratories = [{"id": row[0], "name": row[1]} for row in lab_result.all()]

    if department_ids:
        dept_result = await db.execute(
            select(
                Department.id, Department.name, Laboratory.name, Laboratory.full_name
            )
            .join(Laboratory, Department.laboratory_id == Laboratory.id)
            .where(
                Department.id.in_(department_ids),
                Department.deleted_at.is_(None),
                Laboratory.deleted_at.is_(None),
            )
        )
        departments = [
            {
                "id": row[0],
                "name": f"{row[3] or row[2]} — {row[1]}",
            }
            for row in dept_result.all()
        ]

    return {
        **scope,
        "laboratories": laboratories,
        "departments": departments,
    }
