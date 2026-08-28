from __future__ import annotations
from fastapi import APIRouter
from core.deps import BranchItemListFiltersDep, DbSession, UserPermissions
from schemas.sampling_location import (
    SamplingLocationCreate,
    SamplingLocationResponse,
    SamplingLocationUpdate,
)
from services.access_control import enforce_crud_access
from services.branch import require_branch_by_id
from services.sampling_location import (
    create_sampling_location as create_sampling_location_service,
    delete_sampling_location_by_id,
    get_sampling_locations,
    require_sampling_location_by_id,
    update_sampling_location as update_sampling_location_service,
)

router = APIRouter()


@router.get(
    "/laboratories/sampling-locations/",
    response_model=list[SamplingLocationResponse],
    summary="Получение списка мест отбора проб",
    description=("Возвращает список мест отбора проб. Поддерживает фильтрацию по филиалам, поиск и сортировку."),
    responses={200: {"description": "Список мест отбора проб успешно получен"}},
)
# @IsAuthenticated
async def list_sampling_locations(
    db: DbSession,
    _effective: UserPermissions,
    filters: BranchItemListFiltersDep,
):
    return await get_sampling_locations(
        db,
        branch_id=filters.branch_id,
        search=filters.search,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
    )


@router.post(
    "/laboratories/sampling-locations/",
    response_model=SamplingLocationResponse,
    status_code=201,
    summary="Добавление нового места отбора проб",
    description="Добавляет новое место отбора проб на основе переданных данных.",
    responses={
        201: {"description": "Место отбора проб успешно добавлено"},
        400: {"description": "Некорректные данные для добавления места отбора проб"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def create_sampling_location(
    sampling_location_data: SamplingLocationCreate,
    db: DbSession,
    effective: UserPermissions,
):
    branch = await require_branch_by_id(db, sampling_location_data.branch_id)
    enforce_crud_access(
        effective,
        "sampling_locations",
        "create",
        branch.laboratory_id,
        branch.department_id,
    )
    return await create_sampling_location_service(db, sampling_location_data)


@router.get(
    "/laboratories/sampling-locations/{sampling_location_id:int}/",
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
    _effective: UserPermissions,
):
    return await require_sampling_location_by_id(db, sampling_location_id)


@router.patch(
    "/laboratories/sampling-locations/{sampling_location_id:int}/",
    response_model=SamplingLocationResponse,
    summary="Обновление места отбора проб",
    description="Обновляет существующее место отбора проб.",
    responses={
        200: {"description": "Место отбора проб успешно обновлено"},
        403: {"description": "Отказано в доступе"},
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
    location = await require_sampling_location_by_id(db, sampling_location_id)
    branch = await require_branch_by_id(db, location.branch_id)
    enforce_crud_access(
        effective,
        "sampling_locations",
        "update",
        branch.laboratory_id,
        branch.department_id,
    )
    return await update_sampling_location_service(db, location, sampling_location_data)


@router.delete(
    "/laboratories/sampling-locations/{sampling_location_id:int}/",
    status_code=204,
    summary="Удаление места отбора проб",
    description="Выполняет мягкое удаление места отбора проб.",
    responses={
        204: {"description": "Место отбора проб успешно удалено"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Место отбора проб не найдено"},
    },
)
# @IsAuthenticated
async def delete_sampling_location(
    sampling_location_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> None:
    location = await require_sampling_location_by_id(db, sampling_location_id)
    branch = await require_branch_by_id(db, location.branch_id)
    enforce_crud_access(
        effective,
        "sampling_locations",
        "delete",
        branch.laboratory_id,
        branch.department_id,
    )
    await delete_sampling_location_by_id(db, sampling_location_id)
