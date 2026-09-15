from __future__ import annotations
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import ConflictError, NotFoundError
from models.test_purpose import TestPurpose
from repositories import test_purpose as test_purpose_repo
from repositories.base import flush_entity
from schemas.test_purpose import TestPurposeCreate, TestPurposeUpdate
from services.visibility import validate_lab_and_department


async def get_test_purpose_by_id(
    db: AsyncSession, test_purpose_id: int, include_deleted: bool = False
) -> TestPurpose | None:
    """Получить цель испытаний по ID."""
    return await test_purpose_repo.get_test_purpose_by_id(db, test_purpose_id, include_deleted)


async def require_test_purpose_by_id(
    db: AsyncSession, test_purpose_id: int, include_deleted: bool = False
) -> TestPurpose:
    """Вернуть цель испытаний по ID, иначе вызвать NotFoundError."""
    test_purpose = await get_test_purpose_by_id(db, test_purpose_id, include_deleted)
    if not test_purpose:
        raise NotFoundError("Цель испытаний не найдена")
    return test_purpose


async def get_test_purposes(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> list[TestPurpose]:
    """Получить список целей испытаний."""
    return await test_purpose_repo.get_test_purposes(db, laboratory_id, department_id, search, sort_by, sort_order)


def resolve_test_purpose_update_scope(test_purpose: TestPurpose, data: TestPurposeUpdate) -> tuple[int, int | None]:
    """Определить laboratory_id и department_id после PATCH."""
    laboratory_id = data.laboratory_id if data.laboratory_id is not None else test_purpose.laboratory_id
    department_id = data.department_id if "department_id" in data.model_fields_set else test_purpose.department_id
    return laboratory_id, department_id


async def create_test_purpose(db: AsyncSession, data: TestPurposeCreate) -> TestPurpose:
    """Создать цель испытаний."""
    await validate_lab_and_department(db, data.laboratory_id, data.department_id)
    if await test_purpose_repo.exists_test_purpose_by_name(db, data.name, data.laboratory_id, data.department_id):
        raise ConflictError("Цель испытаний с таким названием уже существует")
    test_purpose = TestPurpose(
        name=data.name,
        laboratory_id=data.laboratory_id,
        department_id=data.department_id,
    )
    await test_purpose_repo.add_test_purpose(db, test_purpose)
    return await require_test_purpose_by_id(db, test_purpose.id)


async def update_test_purpose(
    db: AsyncSession,
    test_purpose: TestPurpose,
    data: TestPurposeUpdate,
) -> TestPurpose:
    """Обновить цель испытаний."""
    laboratory_id, department_id = resolve_test_purpose_update_scope(test_purpose, data)
    await validate_lab_and_department(db, laboratory_id, department_id)

    name = data.name if data.name is not None else test_purpose.name
    if await test_purpose_repo.exists_test_purpose_by_name(
        db, name, laboratory_id, department_id, exclude_id=test_purpose.id
    ):
        raise ConflictError("Цель испытаний с таким названием уже существует")

    if data.name is not None:
        test_purpose.name = data.name
    if data.laboratory_id is not None:
        test_purpose.laboratory_id = data.laboratory_id
    if "department_id" in data.model_fields_set:
        test_purpose.department_id = data.department_id

    await flush_entity(db)
    return await require_test_purpose_by_id(db, test_purpose.id)


async def delete_test_purpose(db: AsyncSession, test_purpose: TestPurpose) -> None:
    """Мягко удалить цель испытаний."""
    test_purpose.soft_delete()
    await flush_entity(db)
