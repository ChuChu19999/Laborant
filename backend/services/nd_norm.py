from typing import List, Optional
import pendulum
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from core.exceptions import NotFoundError, ValidationError
from models.laboratory import Department, Laboratory
from models.nd_norm import NdNorm
from models.research import ResearchMethod
from schemas.nd_norm import NdNormCreate, NdNormMethodDataItem, NdNormUpdate
from services.test_object import get_test_object_names
from utils.filters import add_date_range_filter
from utils.pagination import apply_pagination, calculate_total_pages, get_total_count
from utils.sorting import build_order_by


def _normalize_method_data(
    method_data: Optional[List[NdNormMethodDataItem]],
) -> List[dict]:
    if not method_data:
        return []
    return [{"method_id": item.method_id, "text": item.text} for item in method_data]


async def _validate_lab_and_department(
    db: AsyncSession,
    laboratory_id: int,
    department_id: Optional[int],
) -> None:
    laboratory = await db.execute(
        select(Laboratory).where(
            Laboratory.id == laboratory_id,
            Laboratory.deleted_at.is_(None),
        )
    )
    if not laboratory.scalar_one_or_none():
        raise NotFoundError("Лаборатория не найдена")

    if department_id:
        department = await db.execute(
            select(Department).where(
                Department.id == department_id,
                Department.deleted_at.is_(None),
            )
        )
        dept = department.scalar_one_or_none()
        if not dept:
            raise NotFoundError("Подразделение не найдено")
        if dept.laboratory_id != laboratory_id:
            raise ValidationError(
                "Подразделение должно принадлежать выбранной лаборатории"
            )


async def _validate_test_object(
    db: AsyncSession,
    test_object: str,
    laboratory_id: int,
    department_id: Optional[int],
) -> None:
    names = await get_test_object_names(db, laboratory_id, department_id)
    normalized = test_object.strip().lower()
    if not any(name.lower() == normalized for name in names):
        raise ValidationError("Объект испытаний не найден в справочнике")


async def _validate_method_data(
    db: AsyncSession,
    method_data: List[NdNormMethodDataItem],
    laboratory_id: int,
    department_id: Optional[int],
) -> None:
    if not method_data:
        return

    method_ids = {item.method_id for item in method_data}
    query = select(ResearchMethod.id).where(
        ResearchMethod.id.in_(method_ids),
        ResearchMethod.deleted_at.is_(None),
        ResearchMethod.laboratory_id == laboratory_id,
    )
    if department_id:
        query = query.where(ResearchMethod.department_id == department_id)

    result = await db.execute(query)
    found_ids = {row[0] for row in result.all()}
    missing_ids = method_ids - found_ids
    if missing_ids:
        raise ValidationError(
            "Некорректные методы исследования: "
            f"{', '.join(str(method_id) for method_id in sorted(missing_ids))}"
        )


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
        query = query.where(NdNorm.deleted_at.is_(None))
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_nd_norms_list(
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
) -> tuple[List[NdNorm], int, int]:
    """Получить список норм НД."""
    query = (
        select(NdNorm)
        .where(NdNorm.deleted_at.is_(None))
        .options(selectinload(NdNorm.laboratory), selectinload(NdNorm.department))
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
        total_pages = calculate_total_pages(total, page_size)
        query = apply_pagination(query, page, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    result = await db.execute(query)
    return result.scalars().all(), total, total_pages


async def create_nd_norm(db: AsyncSession, data: NdNormCreate) -> NdNorm:
    """Создать норму НД."""
    await _validate_lab_and_department(db, data.laboratory_id, data.department_id)
    await _validate_test_object(
        db, data.test_object, data.laboratory_id, data.department_id
    )
    await _validate_method_data(
        db, data.method_data, data.laboratory_id, data.department_id
    )

    nd_norm = NdNorm(
        name=data.name,
        test_object=data.test_object,
        laboratory_id=data.laboratory_id,
        department_id=data.department_id,
        method_data=_normalize_method_data(data.method_data),
    )
    db.add(nd_norm)
    await db.flush()

    return await get_nd_norm_by_id(db, nd_norm.id)


async def update_nd_norm(
    db: AsyncSession,
    nd_norm_id: int,
    data: NdNormUpdate,
) -> NdNorm:
    """Обновить норму НД."""
    nd_norm = await get_nd_norm_by_id(db, nd_norm_id)
    if not nd_norm:
        raise NotFoundError("Норма НД не найдена")

    update_data = data.model_dump(exclude_unset=True)
    laboratory_id = update_data.get("laboratory_id", nd_norm.laboratory_id)
    department_id = update_data.get("department_id", nd_norm.department_id)

    if "laboratory_id" in update_data or "department_id" in update_data:
        await _validate_lab_and_department(db, laboratory_id, department_id)

    if "method_data" in update_data and update_data["method_data"] is not None:
        method_items = [
            NdNormMethodDataItem(**item) for item in update_data["method_data"]
        ]
        await _validate_method_data(db, method_items, laboratory_id, department_id)
        nd_norm.method_data = _normalize_method_data(method_items)

    if "test_object" in update_data and update_data["test_object"] is not None:
        await _validate_test_object(
            db, update_data["test_object"], laboratory_id, department_id
        )
        nd_norm.test_object = update_data["test_object"]

    if "name" in update_data and update_data["name"] is not None:
        nd_norm.name = update_data["name"]
    if "laboratory_id" in update_data and update_data["laboratory_id"] is not None:
        nd_norm.laboratory_id = update_data["laboratory_id"]
    if "department_id" in update_data:
        nd_norm.department_id = update_data["department_id"]

    await db.flush()
    return await get_nd_norm_by_id(db, nd_norm.id)


async def delete_nd_norm(db: AsyncSession, nd_norm_id: int) -> None:
    """Мягко удалить норму НД."""
    nd_norm = await get_nd_norm_by_id(db, nd_norm_id)
    if not nd_norm:
        raise NotFoundError("Норма НД не найдена")
    nd_norm.soft_delete()
    await db.flush()
