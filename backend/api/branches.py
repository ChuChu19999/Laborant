from __future__ import annotations
from fastapi import APIRouter, Query
from core.deps import DbSession, UserPermissions
from schemas.laboratory import (
    BranchCreate,
    BranchResponse,
    BranchUpdate,
)
from services.access_control import enforce_lab_management_access
from services.laboratory import (
    create_branch as create_branch_service,
    delete_branch as delete_branch_service,
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
    effective: UserPermissions,
    laboratory_id: int | None = Query(None),
    department_id: int | None = Query(None),
    search: str | None = Query(None),
    sort_by: str | None = Query(None),
    sort_order: str | None = Query("desc"),
):
    """Возвращает список филиалов."""
    branches = await get_branches(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return [BranchResponse.model_validate(branch) for branch in branches]


@router.post(
    "/branches/",
    response_model=BranchResponse,
    status_code=201,
    summary="Добавление нового филиала",
    description="Добавляет новый филиал на основе переданных данных.",
    responses={
        201: {"description": "Филиал успешно добавлен"},
        400: {"description": "Некорректные данные для добавления филиала"},
    },
)
# @IsAuthenticated
async def create_branch(
    branch_data: BranchCreate,
    db: DbSession,
    effective: UserPermissions,
):
    """Добавляет новый филиал на основе переданных данных."""
    enforce_lab_management_access(effective, branch_data.laboratory_id, branch_data.department_id)
    branch = await create_branch_service(db, branch_data)
    return BranchResponse.model_validate(branch)


@router.patch(
    "/branches/{branch_id}/",
    response_model=BranchResponse,
    summary="Обновление филиала",
    description="Обновляет существующий филиал.",
    responses={
        200: {"description": "Филиал успешно обновлен"},
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
    """Обновляет существующий филиал."""
    branch = await require_branch_by_id(db, branch_id)
    enforce_lab_management_access(effective, branch.laboratory_id, branch.department_id)
    branch = await update_branch_service(db, branch_id, branch_data)
    return BranchResponse.model_validate(branch)


@router.delete(
    "/branches/{branch_id}/",
    status_code=204,
    summary="Удаление филиала",
    description="Выполняет мягкое удаление филиала.",
    responses={
        204: {"description": "Филиал успешно удален"},
        404: {"description": "Филиал не найден"},
    },
)
# @IsAuthenticated
async def delete_branch(
    branch_id: int,
    db: DbSession,
    effective: UserPermissions,
):
    """Выполняет мягкое удаление филиала."""
    branch = await require_branch_by_id(db, branch_id)
    enforce_lab_management_access(effective, branch.laboratory_id, branch.department_id)
    await delete_branch_service(db, branch_id)
