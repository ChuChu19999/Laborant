from __future__ import annotations
from fastapi import APIRouter, Query
from core.auth_decorators import IsAuthenticated
from core.deps import DbSession, UserPermissions
from schemas.laboratory import (
    WellModeCreate,
    WellModeResponse,
    WellModeUpdate,
)
from services.access_control import enforce_crud_access
from services.laboratory import (
    build_well_mode_response,
)
from services.laboratory import create_well_mode as create_well_mode_service
from services.laboratory import delete_well_mode as delete_well_mode_service
from services.laboratory import (
    get_well_mode_response_data,
    get_well_modes,
    require_branch_by_id,
    require_well_mode_by_id,
)
from services.laboratory import update_well_mode as update_well_mode_service

router = APIRouter()


@router.get(
    "/laboratories/well-modes/",
    response_model=list[WellModeResponse],
    summary="Получение списка режимов скважин",
    description=(
        "Возвращает список режимов скважин. "
        "Поддерживает фильтрацию по филиалам, поиск и сортировку."
    ),
    responses={200: {"description": "Список режимов скважин успешно получен"}},
)
# @IsAuthenticated
async def list_well_modes(
    db: DbSession,
    effective: UserPermissions,
    branch_id: int | None = Query(None),
    search: str | None = Query(None),
    sort_by: str | None = Query(None),
    sort_order: str | None = Query("desc"),
):
    """Возвращает список режимов скважин."""
    well_modes = await get_well_modes(
        db,
        branch_id=branch_id,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return [build_well_mode_response(mode) for mode in well_modes]


@router.post(
    "/laboratories/well-modes/",
    response_model=WellModeResponse,
    status_code=201,
    summary="Добавление нового режима скважины",
    description="Добавляет новый режим скважины на основе переданных данных.",
    responses={
        201: {"description": "Режим скважины успешно добавлен"},
        400: {"description": "Некорректные данные для добавления режима скважины"},
    },
)
# @IsAuthenticated
async def create_well_mode(
    well_mode_data: WellModeCreate,
    db: DbSession,
    effective: UserPermissions,
):
    """Добавляет новый режим скважины на основе переданных данных."""
    branch = await require_branch_by_id(db, well_mode_data.branch_id)
    enforce_crud_access(
        effective,
        "sampling_locations",
        "create",
        branch.laboratory_id,
        branch.department_id,
    )
    well_mode = await create_well_mode_service(db, well_mode_data)
    return await get_well_mode_response_data(db, well_mode.id)


@router.get(
    "/laboratories/well-modes/{well_mode_id}/",
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
    effective: UserPermissions,
):
    """Возвращает информацию о режиме скважины по его идентификатору."""
    return await get_well_mode_response_data(db, well_mode_id)


@router.patch(
    "/laboratories/well-modes/{well_mode_id}/",
    response_model=WellModeResponse,
    summary="Обновление режима скважины",
    description="Обновляет существующий режим скважины.",
    responses={
        200: {"description": "Режим скважины успешно обновлен"},
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
    """Обновляет существующий режим скважины."""
    well_mode = await require_well_mode_by_id(db, well_mode_id)
    branch = await require_branch_by_id(db, well_mode.branch_id)
    enforce_crud_access(
        effective,
        "sampling_locations",
        "update",
        branch.laboratory_id,
        branch.department_id,
    )
    await update_well_mode_service(db, well_mode_id, well_mode_data)
    return await get_well_mode_response_data(db, well_mode_id)


@router.delete(
    "/laboratories/well-modes/{well_mode_id}/",
    status_code=204,
    summary="Удаление режима скважины",
    description="Выполняет мягкое удаление режима скважины.",
    responses={
        204: {"description": "Режим скважины успешно удален"},
        404: {"description": "Режим скважины не найден"},
    },
)
# @IsAuthenticated
async def delete_well_mode(
    well_mode_id: int,
    db: DbSession,
    effective: UserPermissions,
):
    """Выполняет мягкое удаление режима скважины."""
    well_mode = await require_well_mode_by_id(db, well_mode_id)
    branch = await require_branch_by_id(db, well_mode.branch_id)
    enforce_crud_access(
        effective,
        "sampling_locations",
        "delete",
        branch.laboratory_id,
        branch.department_id,
    )
    await delete_well_mode_service(db, well_mode_id)
