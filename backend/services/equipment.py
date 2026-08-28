from __future__ import annotations
import pendulum
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import ConflictError, NotFoundError
from models.equipment import Equipment
from repositories import equipment as equipment_repo, research as research_repo
from repositories.base import flush_entity
from schemas.equipment import EquipmentCreate, EquipmentUpdate
from services.visibility import validate_lab_and_department
from utils.versioning import next_version_string


async def get_equipment_by_id(db: AsyncSession, equipment_id: int, include_deleted: bool = False) -> Equipment | None:
    """Получить оборудование по ID или None, если записи нет."""
    return await equipment_repo.get_equipment_by_id(db, equipment_id, include_deleted)


async def require_equipment_by_id(db: AsyncSession, equipment_id: int, include_deleted: bool = False) -> Equipment:
    """Вернуть оборудование по ID; если записи нет — NotFoundError."""
    equipment = await get_equipment_by_id(db, equipment_id, include_deleted)
    if not equipment:
        raise NotFoundError("Оборудование не найдено")
    return equipment


async def get_equipment_by_ids(
    db: AsyncSession,
    equipment_ids: list[int],
    include_deleted: bool = True,
) -> dict[int, Equipment]:
    """Получить словарь оборудования по списку ID."""
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
) -> tuple[list[Equipment], int]:
    """Получить список оборудования и число записей по фильтрам."""
    return await equipment_repo.get_equipment(
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


async def create_equipment(db: AsyncSession, equipment_data: EquipmentCreate) -> Equipment:
    """Создать оборудование; при совпадении имени в лаборатории/подразделении — ConflictError."""
    await validate_lab_and_department(db, equipment_data.laboratory_id, equipment_data.department_id)

    existing = await equipment_repo.get_latest_equipment_version(
        db,
        equipment_data.name,
        equipment_data.laboratory_id,
        equipment_data.department_id,
    )
    if existing:
        raise ConflictError("Оборудование с таким наименованием уже существует")

    equipment = Equipment(
        type=equipment_data.type,
        name=equipment_data.name,
        serial_number=equipment_data.serial_number,
        verification_info=equipment_data.verification_info,
        verification_date=equipment_data.verification_date,
        verification_end_date=equipment_data.verification_end_date,
        version=next_version_string(None),
        laboratory_id=equipment_data.laboratory_id,
        department_id=equipment_data.department_id,
        method_data_default=equipment_data.method_data_default or [],
    )
    equipment = await equipment_repo.add_equipment(db, equipment)
    return await require_equipment_by_id(db, equipment.id)


async def update_equipment(
    db: AsyncSession,
    old_equipment: Equipment,
    equipment_data: EquipmentUpdate,
) -> Equipment:
    """Мягко удалить текущую запись и создать новую версию прибора с перешивкой методов."""
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

    if (
        new_name != old_equipment.name
        or lab_id != old_equipment.laboratory_id
        or dept_id != old_equipment.department_id
    ):
        conflict = await equipment_repo.get_latest_equipment_version(db, new_name, lab_id, dept_id)
        if conflict and conflict.id != old_equipment.id:
            raise ConflictError("Оборудование с таким наименованием уже существует")

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

    await _replace_equipment_in_research_methods(db, old_equipment_id, new_equipment.id)

    return await require_equipment_by_id(db, new_equipment.id)


async def _replace_equipment_in_research_methods(
    db: AsyncSession,
    old_equipment_id: int,
    new_equipment_id: int,
) -> None:
    """Подменить в equipment_data_default методов старый id прибора на новый."""
    methods = await research_repo.get_research_methods_referencing_equipment(db, old_equipment_id)
    if not methods:
        return

    for method in methods:
        equipment_ids = method.equipment_data_default
        if not isinstance(equipment_ids, list):
            continue
        method.equipment_data_default = [
            new_equipment_id if eq_id == old_equipment_id else eq_id for eq_id in equipment_ids
        ]

    await flush_entity(db)


async def _remove_equipment_from_research_methods(db: AsyncSession, equipment_id: int) -> None:
    """Убрать id прибора из equipment_data_default у всех ссылающихся методов."""
    methods = await research_repo.get_research_methods_referencing_equipment(db, equipment_id)
    if not methods:
        return

    for method in methods:
        equipment_ids = method.equipment_data_default
        if not isinstance(equipment_ids, list):
            continue
        method.equipment_data_default = [eq_id for eq_id in equipment_ids if eq_id != equipment_id]

    await flush_entity(db)


async def delete_equipment(db: AsyncSession, equipment: Equipment) -> None:
    """Мягко удалить оборудование и убрать его из привязок методов."""
    await _remove_equipment_from_research_methods(db, equipment.id)
    equipment.soft_delete()
    await flush_entity(db)


def resolve_equipment_update_scope(
    existing: Equipment,
    equipment_data: EquipmentUpdate,
) -> tuple[int, int | None]:
    """Определить область доступа после PATCH оборудования."""
    fields_set = equipment_data.model_fields_set
    laboratory_id = (
        equipment_data.laboratory_id
        if "laboratory_id" in fields_set and equipment_data.laboratory_id is not None
        else existing.laboratory_id
    )
    department_id = equipment_data.department_id if "department_id" in fields_set else existing.department_id
    return laboratory_id, department_id
