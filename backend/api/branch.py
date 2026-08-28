from __future__ import annotations
from fastapi import APIRouter
from core.deps import BranchListFiltersDep, DbSession, UserPermissions
from schemas.branch import BranchCreate, BranchResponse, BranchUpdate
from services.access_control import enforce_lab_management_access
from services.branch import (
    create_branch as create_branch_service,
    delete_branch_by_id,
    get_branches,
    require_branch_by_id,
    update_branch as update_branch_service,
)

router = APIRouter()


@router.get(
    "/branches/",
    response_model=list[BranchResponse],
    summary="Получение списка филиалов",
    description=(
        "Возвращает список филиалов. Поддерживает фильтрацию по лабораториям и подразделениям, поиск и сортировку."
    ),
    responses={200: {"description": "Список филиалов успешно получен"}},
)
# @IsAuthenticated
async def list_branches(
    db: DbSession,
    _effective: UserPermissions,
    filters: BranchListFiltersDep,
):
    return await get_branches(
        db,
        laboratory_id=filters.laboratory_id,
        department_id=filters.department_id,
        search=filters.search,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
    )


@router.post(
    "/branches/",
    response_model=BranchResponse,
    status_code=201,
    summary="Добавление нового филиала",
    description="Добавляет новый филиал на основе переданных данных.",
    responses={
        201: {"description": "Филиал успешно добавлен"},
        400: {"description": "Некорректные данные для добавления филиала"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def create_branch(
    branch_data: BranchCreate,
    db: DbSession,
    effective: UserPermissions,
):
    enforce_lab_management_access(effective, branch_data.laboratory_id, branch_data.department_id)
    return await create_branch_service(db, branch_data)


@router.patch(
    "/branches/{branch_id:int}/",
    response_model=BranchResponse,
    summary="Обновление филиала",
    description="Обновляет существующий филиал.",
    responses={
        200: {"description": "Филиал успешно обновлен"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Филиал не найден"},
    },
)
# @IsAuthenticated
async def update_branch(
    branch_id: int,
    branch_data: BranchUpdate,
    db: DbSession,
    effective: UserPermissions,
):
    branch = await require_branch_by_id(db, branch_id)
    enforce_lab_management_access(effective, branch.laboratory_id, branch.department_id)
    return await update_branch_service(db, branch, branch_data)


@router.delete(
    "/branches/{branch_id:int}/",
    status_code=204,
    summary="Удаление филиала",
    description="Выполняет мягкое удаление филиала.",
    responses={
        204: {"description": "Филиал успешно удалён"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Филиал не найден"},
    },
)
# @IsAuthenticated
async def delete_branch(
    branch_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> None:
    branch = await require_branch_by_id(db, branch_id, load_sampling_locations=True)
    enforce_lab_management_access(effective, branch.laboratory_id, branch.department_id)
    await delete_branch_by_id(db, branch_id, branch=branch)
