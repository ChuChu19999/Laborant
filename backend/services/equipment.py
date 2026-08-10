from __future__ import annotations
import pendulum
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import NotFoundError
from models.equipment import Equipment
from repositories import equipment as equipment_repo, research as research_repo
from repositories.base import flush_entity
from schemas.equipment import EquipmentCreate, EquipmentResponse, EquipmentUpdate
from services.visibility import validate_lab_and_department
from utils.pagination import calculate_total_pages
from utils.versioning import next_version_string


async def get_equipment_by_id(db: AsyncSession, equipment_id: int, include_deleted: bool = False) -> Equipment | None:
    """Получить оборудование по ID."""
    return await equipment_repo.get_equipment_by_id(db, equipment_id, include_deleted)


async def require_equipment_by_id(db: AsyncSession, equipment_id: int, include_deleted: bool = False) -> Equipment:
    """Получить оборудование по ID или вернуть 404."""
    equipment = await get_equipment_by_id(db, equipment_id, include_deleted)
    if not equipment:
        raise NotFoundError("Оборудование не найдено")
    return equipment


async def get_equipment_by_ids(
    db: AsyncSession,
    equipment_ids: list[int],
    include_deleted: bool = True,
) -> dict[int, Equipment]:
    """Получить оборудование по списку ID."""
    return await equipment_repo.get_equipment_by_ids(db, equipment_ids, include_deleted)


async def get_equipment(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    equipment_types: list[str] | None = None,
    page: int | None = None,
    page_size: int | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
    verification_date_from: pendulum.DateTime | None = None,
    verification_date_to: pendulum.DateTime | None = None,
    verification_end_date_from: pendulum.DateTime | None = None,
    verification_end_date_to: pendulum.DateTime | None = None,
    created_at_from: pendulum.DateTime | None = None,
    created_at_to: pendulum.DateTime | None = None,
) -> tuple[list[Equipment], int, int]:
    """Получить список оборудования."""
    equipment_list, total = await equipment_repo.get_equipment(
        db,
        laboratory_id,
        department_id,
        equipment_types,
        page,
        page_size,
        search,
        sort_by,
        sort_order,
        verification_date_from,
        verification_date_to,
        verification_end_date_from,
        verification_end_date_to,
        created_at_from,
        created_at_to,
    )

    if page is not None and page_size is not None:
        total_pages = calculate_total_pages(total, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    return equipment_list, total, total_pages


def build_equipment_response(equipment: Equipment) -> EquipmentResponse:
    """Собрать ответ API по оборудованию с наименованиями связей."""
    eq_dict = EquipmentResponse.model_validate(equipment).model_dump()
    if equipment.laboratory:
        eq_dict["laboratory_name"] = equipment.laboratory.name
    if equipment.department:
        eq_dict["department_name"] = equipment.department.name
    return EquipmentResponse(**eq_dict)


async def create_equipment(db: AsyncSession, equipment_data: EquipmentCreate) -> Equipment:
    """Создать оборудование."""
    await validate_lab_and_department(db, equipment_data.laboratory_id, equipment_data.department_id)

    latest_equipment = await equipment_repo.get_latest_equipment_version(
        db,
        equipment_data.name,
        equipment_data.laboratory_id,
        equipment_data.department_id,
    )

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
        method_data_default=equipment_data.method_data_default or [],
    )
    equipment = await equipment_repo.add_equipment(db, equipment)

    if latest_equipment:
        old_equipment_id = latest_equipment.id
        await _update_research_methods_with_new_equipment_version(
            db,
            old_equipment_id,
            equipment.id,
            equipment_data.laboratory_id,
            equipment_data.department_id,
        )

    equipment = await equipment_repo.get_equipment_by_id(db, equipment.id)
    if not equipment:
        raise NotFoundError("Оборудование не найдено")
    return equipment


async def update_equipment(db: AsyncSession, equipment_id: int, equipment_data: EquipmentUpdate) -> Equipment:
    """Обновить оборудование. Старая запись помечается как удаленная, создается новая с новой версией."""
    old_equipment = await get_equipment_by_id(db, equipment_id)
    if not old_equipment:
        raise NotFoundError("Оборудование не найдено")

    update_data = equipment_data.model_dump(exclude_unset=True)

    new_name = update_data.get("name", old_equipment.name)
    new_type = update_data.get("type", old_equipment.type)
    new_serial_number = update_data.get("serial_number", old_equipment.serial_number)
    new_verification_info = update_data.get("verification_info", old_equipment.verification_info)
    new_verification_date = update_data.get("verification_date", old_equipment.verification_date)
    new_verification_end_date = update_data.get("verification_end_date", old_equipment.verification_end_date)
    new_method_data_default = update_data.get("method_data_default", old_equipment.method_data_default)

    lab_id = equipment_data.laboratory_id if equipment_data.laboratory_id is not None else old_equipment.laboratory_id
    dept_id = equipment_data.department_id if equipment_data.department_id is not None else old_equipment.department_id

    if equipment_data.laboratory_id is not None or equipment_data.department_id is not None:
        await validate_lab_and_department(db, lab_id, dept_id)

    next_version = next_version_string(old_equipment.version)

    old_equipment_id = old_equipment.id
    old_equipment.soft_delete()
    await flush_entity(db)

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
        method_data_default=new_method_data_default,
    )
    new_equipment = await equipment_repo.add_equipment(db, new_equipment)

    await _update_research_methods_with_new_equipment_version(db, old_equipment_id, new_equipment.id, lab_id, dept_id)

    equipment = await equipment_repo.get_equipment_by_id(db, new_equipment.id)
    if not equipment:
        raise NotFoundError("Оборудование не найдено")
    return equipment


async def _update_research_methods_with_new_equipment_version(
    db: AsyncSession,
    old_equipment_id: int,
    new_equipment_id: int,
    laboratory_id: int,
    department_id: int | None,
) -> None:
    """Обновить методы исследования, привязанные к старой версии прибора."""
    methods = await research_repo.get_research_methods_for_equipment_update(db, laboratory_id, department_id)

    has_updates = False
    for method in methods:
        if not method.equipment_data_default:
            continue

        equipment_ids = method.equipment_data_default
        if not isinstance(equipment_ids, list):
            continue

        if old_equipment_id in equipment_ids:
            equipment_ids = [new_equipment_id if eq_id == old_equipment_id else eq_id for eq_id in equipment_ids]
            method.equipment_data_default = equipment_ids
            has_updates = True

    if has_updates:
        await flush_entity(db)


async def _remove_equipment_from_research_methods(db: AsyncSession, equipment_id: int) -> None:
    """Удалить прибор из equipment_data_default во всех методах исследования."""
    methods = await research_repo.get_all_research_methods_for_equipment_removal(db)

    has_updates = False
    for method in methods:
        if not method.equipment_data_default:
            continue

        equipment_ids = method.equipment_data_default
        if not isinstance(equipment_ids, list):
            continue

        if equipment_id in equipment_ids:
            equipment_ids = [eq_id for eq_id in equipment_ids if eq_id != equipment_id]
            method.equipment_data_default = equipment_ids
            has_updates = True

    if has_updates:
        await flush_entity(db)


async def delete_equipment(db: AsyncSession, equipment_id: int) -> None:
    """Удалить оборудование (мягкое удаление)."""
    equipment = await get_equipment_by_id(db, equipment_id)
    if not equipment:
        raise NotFoundError("Оборудование не найдено")

    await _remove_equipment_from_research_methods(db, equipment_id)
    equipment.soft_delete()
    await flush_entity(db)
