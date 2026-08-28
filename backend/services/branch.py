from __future__ import annotations
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import DomainValidationError, NotFoundError
from models.branch import Branch
from repositories import branch as branch_repo
from repositories.base import flush_entity
from schemas.branch import BranchCreate, BranchUpdate
from services.department import require_department_by_id
from services.laboratory import require_laboratory_by_id


async def get_branch_by_id(
    db: AsyncSession,
    branch_id: int,
    include_deleted: bool = False,
    *,
    load_sampling_locations: bool = False,
) -> Branch | None:
    """Получить филиал по ID."""
    return await branch_repo.get_branch_by_id(
        db,
        branch_id,
        include_deleted,
        load_sampling_locations=load_sampling_locations,
    )


async def require_branch_by_id(
    db: AsyncSession,
    branch_id: int,
    include_deleted: bool = False,
    *,
    load_sampling_locations: bool = False,
) -> Branch:
    """Вернуть филиал по ID, иначе вызвать NotFoundError."""
    branch = await get_branch_by_id(
        db,
        branch_id,
        include_deleted,
        load_sampling_locations=load_sampling_locations,
    )
    if not branch:
        raise NotFoundError("Филиал не найден")
    return branch


async def get_branches(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> list[Branch]:
    """Получить список филиалов."""
    return await branch_repo.get_branches(db, laboratory_id, department_id, search, sort_by, sort_order)


async def create_branch(db: AsyncSession, branch_data: BranchCreate) -> Branch:
    """Создать филиал после проверки лаборатории и подразделения."""
    await require_laboratory_by_id(db, branch_data.laboratory_id, include_deleted=True)

    if branch_data.department_id is not None:
        department = await require_department_by_id(db, branch_data.department_id, include_deleted=True)
        if department.laboratory_id != branch_data.laboratory_id:
            raise DomainValidationError("Подразделение должно принадлежать выбранной лаборатории")

    branch = Branch(
        name=branch_data.name,
        phone=branch_data.phone,
        laboratory_id=branch_data.laboratory_id,
        department_id=branch_data.department_id,
    )
    await branch_repo.add_branch(db, branch)
    return await require_branch_by_id(db, branch.id)


async def update_branch(db: AsyncSession, branch: Branch, branch_data: BranchUpdate) -> Branch:
    """Обновить филиал."""
    if branch_data.name is not None:
        branch.name = branch_data.name
    if branch_data.phone is not None:
        branch.phone = branch_data.phone

    await flush_entity(db)
    return await require_branch_by_id(db, branch.id)


async def delete_branch(db: AsyncSession, branch: Branch) -> None:
    """Мягко удалить филиал вместе с активными местами отбора проб."""
    for sampling_location in branch.sampling_locations:
        if sampling_location.deleted_at is None:
            sampling_location.soft_delete()

    branch.soft_delete()
    await flush_entity(db)


async def delete_branch_by_id(
    db: AsyncSession,
    branch_id: int,
    *,
    branch: Branch | None = None,
) -> None:
    """Мягко удалить филиал по ID вместе с активными местами отбора проб."""
    if branch is None:
        branch = await require_branch_by_id(db, branch_id, load_sampling_locations=True)
    await delete_branch(db, branch)
