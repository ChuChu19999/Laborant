from __future__ import annotations
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import ConflictError, NotFoundError
from models.well_mode import WellMode
from repositories import well_mode as well_mode_repo
from repositories.base import flush_entity
from schemas.well_mode import WellModeCreate, WellModeUpdate
from services.branch import require_branch_by_id


async def get_well_mode_by_id(db: AsyncSession, well_mode_id: int, include_deleted: bool = False) -> WellMode | None:
    """Получить режим скважины по ID."""
    return await well_mode_repo.get_well_mode_by_id(db, well_mode_id, include_deleted)


async def require_well_mode_by_id(db: AsyncSession, well_mode_id: int, include_deleted: bool = False) -> WellMode:
    """Вернуть режим скважины по ID, иначе вызвать NotFoundError."""
    well_mode = await get_well_mode_by_id(db, well_mode_id, include_deleted)
    if not well_mode:
        raise NotFoundError("Режим скважины не найден")
    return well_mode


async def get_well_modes(
    db: AsyncSession,
    branch_id: int | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> list[WellMode]:
    """Получить список режимов скважин."""
    return await well_mode_repo.get_well_modes(db, branch_id, search, sort_by, sort_order)


async def create_well_mode(db: AsyncSession, well_mode_data: WellModeCreate) -> WellMode:
    """Создать режим скважины."""
    branch = await require_branch_by_id(db, well_mode_data.branch_id, include_deleted=True)

    if await well_mode_repo.exists_well_mode_by_name_and_branch(db, well_mode_data.branch_id, well_mode_data.name):
        raise ConflictError("Режим скважины с таким названием уже существует для данного филиала")

    well_mode = WellMode(
        branch_id=well_mode_data.branch_id,
        name=well_mode_data.name,
    )
    well_mode = await well_mode_repo.add_well_mode(db, well_mode)
    well_mode.branch = branch
    return well_mode


async def update_well_mode(
    db: AsyncSession,
    well_mode: WellMode,
    well_mode_data: WellModeUpdate,
) -> WellMode:
    """Обновить режим скважины."""
    if well_mode_data.name is not None:
        if await well_mode_repo.exists_well_mode_by_name_and_branch(
            db,
            well_mode.branch_id,
            well_mode_data.name,
            exclude_id=well_mode.id,
        ):
            raise ConflictError("Режим скважины с таким названием уже существует для данного филиала")
        well_mode.name = well_mode_data.name

    await flush_entity(db)
    return await require_well_mode_by_id(db, well_mode.id)


async def delete_well_mode(db: AsyncSession, well_mode: WellMode) -> None:
    """Мягко удалить режим скважины."""
    well_mode.soft_delete()
    await flush_entity(db)


async def delete_well_mode_by_id(db: AsyncSession, well_mode_id: int) -> None:
    """Мягко удалить режим скважины по ID."""
    well_mode = await require_well_mode_by_id(db, well_mode_id)
    await delete_well_mode(db, well_mode)
