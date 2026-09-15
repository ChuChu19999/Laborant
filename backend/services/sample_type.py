from __future__ import annotations
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import ConflictError, NotFoundError
from models.sample_type import SampleType
from repositories import sample_type as sample_type_repo
from repositories.base import flush_entity
from schemas.sample_type import SampleTypeCreate, SampleTypeUpdate
from services.visibility import validate_lab_and_department


async def get_sample_type_by_id(
    db: AsyncSession, sample_type_id: int, include_deleted: bool = False
) -> SampleType | None:
    """Получить тип пробы по ID."""
    return await sample_type_repo.get_sample_type_by_id(db, sample_type_id, include_deleted)


async def require_sample_type_by_id(db: AsyncSession, sample_type_id: int, include_deleted: bool = False) -> SampleType:
    """Вернуть тип пробы по ID, иначе вызвать NotFoundError."""
    sample_type = await get_sample_type_by_id(db, sample_type_id, include_deleted)
    if not sample_type:
        raise NotFoundError("Тип пробы не найден")
    return sample_type


async def get_sample_types(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> list[SampleType]:
    """Получить список типов проб."""
    return await sample_type_repo.get_sample_types(db, laboratory_id, department_id, search, sort_by, sort_order)


def resolve_sample_type_update_scope(sample_type: SampleType, data: SampleTypeUpdate) -> tuple[int, int | None]:
    """Определить laboratory_id и department_id после PATCH."""
    laboratory_id = data.laboratory_id if data.laboratory_id is not None else sample_type.laboratory_id
    department_id = data.department_id if "department_id" in data.model_fields_set else sample_type.department_id
    return laboratory_id, department_id


async def create_sample_type(db: AsyncSession, data: SampleTypeCreate) -> SampleType:
    """Создать тип пробы."""
    await validate_lab_and_department(db, data.laboratory_id, data.department_id)
    if await sample_type_repo.exists_sample_type_by_name(db, data.name, data.laboratory_id, data.department_id):
        raise ConflictError("Тип пробы с таким названием уже существует")
    sample_type = SampleType(
        name=data.name,
        laboratory_id=data.laboratory_id,
        department_id=data.department_id,
    )
    await sample_type_repo.add_sample_type(db, sample_type)
    return await require_sample_type_by_id(db, sample_type.id)


async def update_sample_type(
    db: AsyncSession,
    sample_type: SampleType,
    data: SampleTypeUpdate,
) -> SampleType:
    """Обновить тип пробы."""
    laboratory_id, department_id = resolve_sample_type_update_scope(sample_type, data)
    await validate_lab_and_department(db, laboratory_id, department_id)

    name = data.name if data.name is not None else sample_type.name
    if await sample_type_repo.exists_sample_type_by_name(
        db, name, laboratory_id, department_id, exclude_id=sample_type.id
    ):
        raise ConflictError("Тип пробы с таким названием уже существует")

    if data.name is not None:
        sample_type.name = data.name
    if data.laboratory_id is not None:
        sample_type.laboratory_id = data.laboratory_id
    if "department_id" in data.model_fields_set:
        sample_type.department_id = data.department_id

    await flush_entity(db)
    return await require_sample_type_by_id(db, sample_type.id)


async def delete_sample_type(db: AsyncSession, sample_type: SampleType) -> None:
    """Мягко удалить тип пробы."""
    sample_type.soft_delete()
    await flush_entity(db)
