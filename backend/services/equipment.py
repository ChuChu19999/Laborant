from typing import List, Optional
import pendulum
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from core.exceptions import ConflictError, NotFoundError, ValidationError
from models.equipment import Equipment
from models.laboratory import Department, Laboratory
from schemas.equipment import EquipmentCreate, EquipmentUpdate
from utils.filters import add_date_range_filter, add_text_search_filter
from utils.pagination import apply_pagination, calculate_total_pages, get_total_count
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
        query = query.where(Equipment.deleted_at.is_(None))
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_equipment_list(
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
) -> tuple[List[Equipment], int, int]:
    """Получить список оборудования."""
    query = (
        select(Equipment)
        .where(Equipment.deleted_at.is_(None))
        .options(selectinload(Equipment.laboratory), selectinload(Equipment.department))
    )

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
        total_pages = calculate_total_pages(total, page_size)
        query = apply_pagination(query, page, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    result = await db.execute(query)
    equipment_list = result.scalars().all()

    return equipment_list, total, total_pages


async def create_equipment(
    db: AsyncSession, equipment_data: EquipmentCreate
) -> Equipment:
    """Создать оборудование."""
    laboratory = await db.execute(
        select(Laboratory).where(Laboratory.id == equipment_data.laboratory_id)
    )
    if not laboratory.scalar_one_or_none():
        raise NotFoundError("Лаборатория не найдена")

    if equipment_data.department_id:
        department = await db.execute(
            select(Department).where(Department.id == equipment_data.department_id)
        )
        dept = department.scalar_one_or_none()
        if not dept:
            raise NotFoundError("Подразделение не найдено")
        if dept.laboratory_id != equipment_data.laboratory_id:
            raise ValidationError(
                "Подразделение должно принадлежать выбранной лаборатории"
            )

    latest = await db.execute(
        select(Equipment)
        .where(Equipment.name == equipment_data.name, Equipment.deleted_at.is_(None))
        .order_by(Equipment.version.desc())
    )
    latest_equipment = latest.scalar_one_or_none()

    if latest_equipment:
        try:
            current_num = int(latest_equipment.version[1:])
            next_version = f"v{current_num + 1}"
        except (ValueError, IndexError):
            next_version = "v1"
    else:
        next_version = "v1"

    equipment = Equipment(
        type=equipment_data.type,
        name=equipment_data.name,
        serial_number=equipment_data.serial_number,
        verification_info=equipment_data.verification_info,
        verification_date=equipment_data.verification_date,
        verification_end_date=equipment_data.verification_end_date,
        version=next_version,
        laboratory_id=equipment_data.laboratory_id,
        department_id=equipment_data.department_id,
    )
    db.add(equipment)
    await db.flush()

    query = (
        select(Equipment)
        .where(Equipment.id == equipment.id)
        .options(selectinload(Equipment.laboratory), selectinload(Equipment.department))
    )
    result = await db.execute(query)
    equipment = result.scalar_one()
    return equipment


async def update_equipment(
    db: AsyncSession, equipment_id: int, equipment_data: EquipmentUpdate
) -> Equipment:
    """Обновить оборудование. Старая запись помечается как удаленная, создается новая с новой версией."""
    old_equipment = await get_equipment_by_id(db, equipment_id)
    if not old_equipment:
        raise NotFoundError("Оборудование не найдено")

    update_data = equipment_data.model_dump(exclude_unset=True)

    new_name = update_data.get("name", old_equipment.name)
    new_type = update_data.get("type", old_equipment.type)
    new_serial_number = update_data.get("serial_number", old_equipment.serial_number)
    new_verification_info = update_data.get(
        "verification_info", old_equipment.verification_info
    )
    new_verification_date = update_data.get(
        "verification_date", old_equipment.verification_date
    )
    new_verification_end_date = update_data.get(
        "verification_end_date", old_equipment.verification_end_date
    )

    lab_id = (
        equipment_data.laboratory_id
        if equipment_data.laboratory_id is not None
        else old_equipment.laboratory_id
    )
    dept_id = (
        equipment_data.department_id
        if equipment_data.department_id is not None
        else old_equipment.department_id
    )

    laboratory = await db.execute(select(Laboratory).where(Laboratory.id == lab_id))
    if not laboratory.scalar_one_or_none():
        raise NotFoundError("Лаборатория не найдена")

    if dept_id:
        department = await db.execute(
            select(Department).where(Department.id == dept_id)
        )
        dept = department.scalar_one_or_none()
        if not dept:
            raise NotFoundError("Подразделение не найдено")
        if dept.laboratory_id != lab_id:
            raise ValidationError(
                "Подразделение должно принадлежать выбранной лаборатории"
            )

    try:
        current_num = int(old_equipment.version[1:])
        next_version = f"v{current_num + 1}"
    except (ValueError, IndexError):
        next_version = "v1"

    old_equipment.soft_delete()
    await db.flush()

    new_equipment = Equipment(
        type=new_type,
        name=new_name,
        serial_number=new_serial_number,
        verification_info=new_verification_info,
        verification_date=new_verification_date,
        verification_end_date=new_verification_end_date,
        version=next_version,
        laboratory_id=lab_id,
        department_id=dept_id,
    )
    db.add(new_equipment)
    await db.flush()

    query = (
        select(Equipment)
        .where(Equipment.id == new_equipment.id)
        .options(selectinload(Equipment.laboratory), selectinload(Equipment.department))
    )
    result = await db.execute(query)
    new_equipment = result.scalar_one()
    return new_equipment


async def delete_equipment(db: AsyncSession, equipment_id: int) -> None:
    """Удалить оборудование (мягкое удаление)."""
    equipment = await get_equipment_by_id(db, equipment_id)
    if not equipment:
        raise NotFoundError("Оборудование не найдено")

    equipment.soft_delete()
    await db.flush()
