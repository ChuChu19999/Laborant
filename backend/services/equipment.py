from typing import List, Optional
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from core.exceptions import ConflictError, NotFoundError, ValidationError
from models.equipment import Equipment
from models.laboratory import Department, Laboratory
from schemas.equipment import EquipmentCreate, EquipmentUpdate
from utils.filters import add_text_search_filter
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
    equipment_type: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[List[Equipment], int, int]:
    """Получить список оборудования с пагинацией."""
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
    if equipment_type:
        conditions.append(Equipment.type == equipment_type)
    if conditions:
        query = query.where(*conditions)

    if search:
        query = query.where(
            or_(
                Equipment.name.ilike(f"%{search}%"),
                Equipment.serial_number.ilike(f"%{search}%"),
            )
        )

    sort_mapping = {
        "name": Equipment.name,
        "version": Equipment.version,
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
    if equipment_type:
        count_conditions.append(Equipment.type == equipment_type)
    if count_conditions:
        count_query = count_query.where(*count_conditions)
    if search:
        count_query = count_query.where(
            or_(
                Equipment.name.ilike(f"%{search}%"),
                Equipment.serial_number.ilike(f"%{search}%"),
            )
        )

    total = await get_total_count(db, count_query)
    total_pages = calculate_total_pages(total, page_size)

    query = apply_pagination(query, page, page_size)
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
    return equipment


async def update_equipment(
    db: AsyncSession, equipment_id: int, equipment_data: EquipmentUpdate
) -> Equipment:
    """Обновить оборудование."""
    equipment = await get_equipment_by_id(db, equipment_id)
    if not equipment:
        raise NotFoundError("Оборудование не найдено")

    update_data = equipment_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(equipment, key, value)

    if (
        equipment_data.laboratory_id is not None
        or equipment_data.department_id is not None
    ):
        lab_id = (
            equipment_data.laboratory_id
            if equipment_data.laboratory_id is not None
            else equipment.laboratory_id
        )
        dept_id = (
            equipment_data.department_id
            if equipment_data.department_id is not None
            else equipment.department_id
        )

        if dept_id:
            department = await db.execute(
                select(Department).where(Department.id == dept_id)
            )
            dept = department.scalar_one_or_none()
            if not dept:
                raise NotFoundError("Подразделение не найдено")
            if lab_id and dept.laboratory_id != lab_id:
                raise ValidationError(
                    "Подразделение должно принадлежать выбранной лаборатории"
                )

    await db.flush()
    return equipment


async def delete_equipment(db: AsyncSession, equipment_id: int) -> None:
    """Удалить оборудование (мягкое удаление)."""
    equipment = await get_equipment_by_id(db, equipment_id)
    if not equipment:
        raise NotFoundError("Оборудование не найдено")

    equipment.soft_delete()
    await db.flush()
