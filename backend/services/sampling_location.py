from __future__ import annotations
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import ConflictError, NotFoundError
from models.sampling_location import SamplingLocation
from repositories import sampling_location as sampling_location_repo
from repositories.base import flush_entity
from schemas.sampling_location import SamplingLocationCreate, SamplingLocationUpdate
from services.branch import require_branch_by_id


async def get_sampling_location_by_id(
    db: AsyncSession, sampling_location_id: int, include_deleted: bool = False
) -> SamplingLocation | None:
    """Получить место отбора пробы по ID."""
    return await sampling_location_repo.get_sampling_location_by_id(db, sampling_location_id, include_deleted)


async def require_sampling_location_by_id(
    db: AsyncSession, sampling_location_id: int, include_deleted: bool = False
) -> SamplingLocation:
    """Вернуть место отбора пробы по ID, иначе вызвать NotFoundError."""
    sampling_location = await get_sampling_location_by_id(db, sampling_location_id, include_deleted)
    if not sampling_location:
        raise NotFoundError("Место отбора пробы не найдено")
    return sampling_location


async def get_sampling_locations(
    db: AsyncSession,
    branch_id: int | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> list[SamplingLocation]:
    """Получить список мест отбора проб."""
    return await sampling_location_repo.get_sampling_locations(db, branch_id, search, sort_by, sort_order)


async def create_sampling_location(
    db: AsyncSession, sampling_location_data: SamplingLocationCreate
) -> SamplingLocation:
    """Создать место отбора пробы."""
    branch = await require_branch_by_id(db, sampling_location_data.branch_id, include_deleted=True)

    if await sampling_location_repo.exists_sampling_location_by_name_and_branch(
        db, sampling_location_data.branch_id, sampling_location_data.name
    ):
        raise ConflictError("Место отбора пробы с таким названием уже существует для данного филиала")

    sampling_location = SamplingLocation(
        branch_id=sampling_location_data.branch_id,
        name=sampling_location_data.name,
    )
    sampling_location = await sampling_location_repo.add_sampling_location(db, sampling_location)
    sampling_location.branch = branch
    return sampling_location


async def update_sampling_location(
    db: AsyncSession,
    sampling_location: SamplingLocation,
    sampling_location_data: SamplingLocationUpdate,
) -> SamplingLocation:
    """Обновить место отбора пробы."""
    if sampling_location_data.name is not None:
        if await sampling_location_repo.exists_sampling_location_by_name_and_branch(
            db,
            sampling_location.branch_id,
            sampling_location_data.name,
            exclude_id=sampling_location.id,
        ):
            raise ConflictError("Место отбора пробы с таким названием уже существует для данного филиала")
        sampling_location.name = sampling_location_data.name

    await flush_entity(db)
    return await require_sampling_location_by_id(db, sampling_location.id)


async def delete_sampling_location(db: AsyncSession, sampling_location: SamplingLocation) -> None:
    """Мягко удалить место отбора пробы."""
    sampling_location.soft_delete()
    await flush_entity(db)


async def delete_sampling_location_by_id(db: AsyncSession, sampling_location_id: int) -> None:
    """Мягко удалить место отбора пробы по ID."""
    sampling_location = await require_sampling_location_by_id(db, sampling_location_id)
    await delete_sampling_location(db, sampling_location)
