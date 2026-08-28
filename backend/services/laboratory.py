from __future__ import annotations
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import ConflictError, NotFoundError
from models.laboratory import Laboratory
from repositories import laboratory as laboratory_repo
from repositories.base import flush_entity
from schemas.laboratory import LaboratoryCreate, LaboratoryUpdate


async def get_laboratory_by_id(
    db: AsyncSession, laboratory_id: int, include_deleted: bool = False
) -> Laboratory | None:
    """Получить лабораторию по ID."""
    return await laboratory_repo.get_laboratory_by_id(db, laboratory_id, include_deleted)


async def require_laboratory_by_id(db: AsyncSession, laboratory_id: int, include_deleted: bool = False) -> Laboratory:
    """Вернуть лабораторию по ID, иначе вызвать NotFoundError."""
    laboratory = await get_laboratory_by_id(db, laboratory_id, include_deleted)
    if not laboratory:
        raise NotFoundError("Лаборатория не найдена")
    return laboratory


async def get_laboratories(
    db: AsyncSession,
    page: int | None = None,
    page_size: int | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[Laboratory], int]:
    """Получить список лабораторий."""
    return await laboratory_repo.get_laboratories(db, page, page_size, search, sort_by, sort_order)


async def create_laboratory(db: AsyncSession, laboratory_data: LaboratoryCreate) -> Laboratory:
    """Создать лабораторию."""
    if await laboratory_repo.exists_laboratory_by_name(db, laboratory_data.name):
        raise ConflictError("Лаборатория с таким названием уже существует")

    laboratory = Laboratory(
        name=laboratory_data.name,
        full_name=laboratory_data.full_name,
        laboratory_location=laboratory_data.laboratory_location,
    )
    laboratory = await laboratory_repo.add_laboratory(db, laboratory)
    return await require_laboratory_by_id(db, laboratory.id)


async def update_laboratory(db: AsyncSession, laboratory: Laboratory, laboratory_data: LaboratoryUpdate) -> Laboratory:
    """Обновить лабораторию."""
    if laboratory_data.name is not None:
        if await laboratory_repo.exists_laboratory_by_name(db, laboratory_data.name, exclude_id=laboratory.id):
            raise ConflictError("Лаборатория с таким названием уже существует")
        laboratory.name = laboratory_data.name

    if laboratory_data.full_name is not None:
        laboratory.full_name = laboratory_data.full_name

    if laboratory_data.laboratory_location is not None:
        laboratory.laboratory_location = laboratory_data.laboratory_location

    await flush_entity(db)
    return await require_laboratory_by_id(db, laboratory.id)


async def delete_laboratory(db: AsyncSession, laboratory_id: int) -> None:
    """Мягко удалить лабораторию вместе с активными подразделениями."""
    laboratory = await require_laboratory_by_id(db, laboratory_id)

    for department in laboratory.departments:
        if department.deleted_at is None:
            department.soft_delete()

    laboratory.soft_delete()
    await flush_entity(db)
