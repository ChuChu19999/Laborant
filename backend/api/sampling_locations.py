from __future__ import annotations
from fastapi import APIRouter, Query
from core.auth_decorators import IsAuthenticated
from core.deps import DbSession, UserPermissions
from schemas.laboratory import (
    SamplingLocationCreate,
    SamplingLocationResponse,
    SamplingLocationUpdate,
)
from services.access_control import enforce_crud_access
from services.laboratory import (
    build_sampling_location_response,
)
from services.laboratory import (
    create_sampling_location as create_sampling_location_service,
)
from services.laboratory import (
    delete_sampling_location as delete_sampling_location_service,
)
from services.laboratory import (
    get_sampling_location_response_data,
    get_sampling_locations,
    require_branch_by_id,
    require_sampling_location_by_id,
)
from services.laboratory import (
    update_sampling_location as update_sampling_location_service,
)

router = APIRouter()


@router.get(
    "/laboratories/sampling-locations/",
    response_model=list[SamplingLocationResponse],
    summary="Получение списка мест отбора проб",
    description=(
        "Возвращает список мест отбора проб. "
        "Поддерживает фильтрацию по филиалам, поиск и сортировку."
    ),
    responses={200: {"description": "Список мест отбора проб успешно получен"}},
)
# @IsAuthenticated
async def list_sampling_locations(
    db: DbSession,
    effective: UserPermissions,
    branch_id: int | None = Query(None),
    search: str | None = Query(None),
    sort_by: str | None = Query(None),
    sort_order: str | None = Query("desc"),
):
    """Возвращает список мест отбора проб."""
    sampling_locations = await get_sampling_locations(
        db,
        branch_id=branch_id,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return [build_sampling_location_response(loc) for loc in sampling_locations]


@router.post(
    "/laboratories/sampling-locations/",
    response_model=SamplingLocationResponse,
    status_code=201,
    summary="Добавление нового места отбора проб",
    description="Добавляет новое место отбора проб на основе переданных данных.",
    responses={
        201: {"description": "Место отбора проб успешно добавлено"},
        400: {"description": "Некорректные данные для добавления места отбора проб"},
    },
)
# @IsAuthenticated
async def create_sampling_location(
    sampling_location_data: SamplingLocationCreate,
    db: DbSession,
    effective: UserPermissions,
):
    """Добавляет новое место отбора проб на основе переданных данных."""
    branch = await require_branch_by_id(db, sampling_location_data.branch_id)
    enforce_crud_access(
        effective,
        "sampling_locations",
        "create",
        branch.laboratory_id,
        branch.department_id,
    )
    sampling_location = await create_sampling_location_service(
        db, sampling_location_data
    )
    return await get_sampling_location_response_data(db, sampling_location.id)


@router.get(
    "/laboratories/sampling-locations/{sampling_location_id}/",
    response_model=SamplingLocationResponse,
    summary="Получение места отбора проб по ID",
    description="Возвращает информацию о месте отбора проб по его идентификатору.",
    responses={
        200: {"description": "Место отбора проб успешно получено"},
        404: {"description": "Место отбора проб не найдено"},
    },
)
# @IsAuthenticated
async def get_sampling_location(
    sampling_location_id: int,
    db: DbSession,
    effective: UserPermissions,
):
    """Возвращает информацию о месте отбора проб по его идентификатору."""
    return await get_sampling_location_response_data(db, sampling_location_id)


@router.patch(
    "/laboratories/sampling-locations/{sampling_location_id}/",
    response_model=SamplingLocationResponse,
    summary="Обновление места отбора проб",
    description="Обновляет существующее место отбора проб.",
    responses={
        200: {"description": "Место отбора проб успешно обновлено"},
        404: {"description": "Место отбора проб не найдено"},
    },
)
# @IsAuthenticated
async def update_sampling_location(
    sampling_location_id: int,
    sampling_location_data: SamplingLocationUpdate,
    db: DbSession,
    effective: UserPermissions,
):
    """Обновляет существующее место отбора проб."""
    location = await require_sampling_location_by_id(db, sampling_location_id)
    branch = await require_branch_by_id(db, location.branch_id)
    enforce_crud_access(
        effective,
        "sampling_locations",
        "update",
        branch.laboratory_id,
        branch.department_id,
    )
    await update_sampling_location_service(
        db, sampling_location_id, sampling_location_data
    )
    return await get_sampling_location_response_data(db, sampling_location_id)


@router.delete(
    "/laboratories/sampling-locations/{sampling_location_id}/",
    status_code=204,
    summary="Удаление места отбора проб",
    description="Выполняет мягкое удаление места отбора проб.",
    responses={
        204: {"description": "Место отбора проб успешно удалено"},
        404: {"description": "Место отбора проб не найдено"},
    },
)
# @IsAuthenticated
async def delete_sampling_location(
    sampling_location_id: int,
    db: DbSession,
    effective: UserPermissions,
):
    """Выполняет мягкое удаление места отбора проб."""
    location = await require_sampling_location_by_id(db, sampling_location_id)
    branch = await require_branch_by_id(db, location.branch_id)
    enforce_crud_access(
        effective,
        "sampling_locations",
        "delete",
        branch.laboratory_id,
        branch.department_id,
    )
    await delete_sampling_location_service(db, sampling_location_id)
