from __future__ import annotations
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import ConflictError, NotFoundError
from models.department import Department
from repositories import department as department_repo
from repositories.base import flush_entity
from schemas.department import DepartmentCreate, DepartmentUpdate
from services.laboratory import require_laboratory_by_id


async def get_department_by_id(
    db: AsyncSession, department_id: int, include_deleted: bool = False
) -> Department | None:
    """Получить подразделение по ID."""
    return await department_repo.get_department_by_id(db, department_id, include_deleted)


async def require_department_by_id(db: AsyncSession, department_id: int, include_deleted: bool = False) -> Department:
    """Вернуть подразделение по ID, иначе вызвать NotFoundError."""
    department = await get_department_by_id(db, department_id, include_deleted)
    if not department:
        raise NotFoundError("Подразделение не найдено")
    return department


async def get_departments(
    db: AsyncSession,
    laboratory_id: int | None = None,
    page: int | None = None,
    page_size: int | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[Department], int]:
    """Получить список подразделений."""
    return await department_repo.get_departments(db, laboratory_id, page, page_size, search, sort_by, sort_order)


async def create_department(db: AsyncSession, department_data: DepartmentCreate) -> Department:
    """Создать подразделение."""
    await require_laboratory_by_id(db, department_data.laboratory_id, include_deleted=True)

    if await department_repo.exists_department_by_name_and_laboratory(
        db, department_data.laboratory_id, department_data.name
    ):
        raise ConflictError("Подразделение с таким названием уже существует для данной лаборатории")

    department = Department(
        laboratory_id=department_data.laboratory_id,
        name=department_data.name,
        laboratory_location=department_data.laboratory_location,
    )
    department = await department_repo.add_department(db, department)
    return await require_department_by_id(db, department.id)


async def update_department(db: AsyncSession, department: Department, department_data: DepartmentUpdate) -> Department:
    """Обновить подразделение."""
    if department_data.name is not None:
        if await department_repo.exists_department_by_name_and_laboratory(
            db,
            department.laboratory_id,
            department_data.name,
            exclude_id=department.id,
        ):
            raise ConflictError("Подразделение с таким названием уже существует для данной лаборатории")
        department.name = department_data.name

    if department_data.laboratory_location is not None:
        department.laboratory_location = department_data.laboratory_location

    await flush_entity(db)
    # Перечитать: после flush onupdate=func.now() протухает updated_at — в async
    # доступ при response_model даёт ResponseValidationError / MissingGreenlet.
    return await require_department_by_id(db, department.id)


async def delete_department(db: AsyncSession, department_id: int) -> None:
    """Мягко удалить подразделение."""
    department = await require_department_by_id(db, department_id)
    department.soft_delete()
    await flush_entity(db)
