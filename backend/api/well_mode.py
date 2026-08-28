from __future__ import annotations
from fastapi import APIRouter
from core.deps import BranchItemListFiltersDep, DbSession, UserPermissions
from schemas.well_mode import WellModeCreate, WellModeResponse, WellModeUpdate
from services.access_control import enforce_crud_access
from services.branch import require_branch_by_id
from services.well_mode import (
    create_well_mode as create_well_mode_service,
    delete_well_mode_by_id,
    get_well_modes,
    require_well_mode_by_id,
    update_well_mode as update_well_mode_service,
)

router = APIRouter()


@router.get(
    "/laboratories/well-modes/",
    response_model=list[WellModeResponse],
    summary="Получение списка режимов скважин",
    description=("Возвращает список режимов скважин. Поддерживает фильтрацию по филиалам, поиск и сортировку."),
    responses={200: {"description": "Список режимов скважин успешно получен"}},
)
# @IsAuthenticated
async def list_well_modes(
    db: DbSession,
    _effective: UserPermissions,
    filters: BranchItemListFiltersDep,
):
    return await get_well_modes(
        db,
        branch_id=filters.branch_id,
        search=filters.search,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
    )


@router.post(
    "/laboratories/well-modes/",
    response_model=WellModeResponse,
    status_code=201,
    summary="Добавление нового режима скважины",
    description="Добавляет новый режим скважины на основе переданных данных.",
    responses={
        201: {"description": "Режим скважины успешно добавлен"},
        400: {"description": "Некорректные данные для добавления режима скважины"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def create_well_mode(
    well_mode_data: WellModeCreate,
    db: DbSession,
    effective: UserPermissions,
):
    branch = await require_branch_by_id(db, well_mode_data.branch_id)
    enforce_crud_access(
        effective,
        "sampling_locations",
        "create",
        branch.laboratory_id,
        branch.department_id,
    )
    return await create_well_mode_service(db, well_mode_data)


@router.get(
    "/laboratories/well-modes/{well_mode_id:int}/",
    response_model=WellModeResponse,
    summary="Получение режима скважины по ID",
    description="Возвращает информацию о режиме скважины по его идентификатору.",
    responses={
        200: {"description": "Режим скважины успешно получен"},
        404: {"description": "Режим скважины не найден"},
    },
)
# @IsAuthenticated
async def get_well_mode(
    well_mode_id: int,
    db: DbSession,
    _effective: UserPermissions,
):
    return await require_well_mode_by_id(db, well_mode_id)


@router.patch(
    "/laboratories/well-modes/{well_mode_id:int}/",
    response_model=WellModeResponse,
    summary="Обновление режима скважины",
    description="Обновляет существующий режим скважины.",
    responses={
        200: {"description": "Режим скважины успешно обновлен"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Режим скважины не найден"},
    },
)
# @IsAuthenticated
async def update_well_mode(
    well_mode_id: int,
    well_mode_data: WellModeUpdate,
    db: DbSession,
    effective: UserPermissions,
):
    well_mode = await require_well_mode_by_id(db, well_mode_id)
    branch = await require_branch_by_id(db, well_mode.branch_id)
    enforce_crud_access(
        effective,
        "sampling_locations",
        "update",
        branch.laboratory_id,
        branch.department_id,
    )
    return await update_well_mode_service(db, well_mode, well_mode_data)


@router.delete(
    "/laboratories/well-modes/{well_mode_id:int}/",
    status_code=204,
    summary="Удаление режима скважины",
    description="Выполняет мягкое удаление режима скважины.",
    responses={
        204: {"description": "Режим скважины успешно удалён"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Режим скважины не найден"},
    },
)
# @IsAuthenticated
async def delete_well_mode(
    well_mode_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> None:
    well_mode = await require_well_mode_by_id(db, well_mode_id)
    branch = await require_branch_by_id(db, well_mode.branch_id)
    enforce_crud_access(
        effective,
        "sampling_locations",
        "delete",
        branch.laboratory_id,
        branch.department_id,
    )
    await delete_well_mode_by_id(db, well_mode_id)
