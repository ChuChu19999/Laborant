from __future__ import annotations
from fastapi import APIRouter, Query
from core.deps import DbSession, DepartmentListFiltersDep, UserPermissions, require_admin
from schemas.department import DepartmentCreate, DepartmentResponse, DepartmentUpdate
from schemas.pagination import PaginatedResponse, build_paginated_response
from services.access_control import enforce_lab_management_access
from services.department import (
    create_department as create_department_service,
    delete_department as delete_department_service,
    get_departments,
    require_department_by_id,
    update_department as update_department_service,
)

router = APIRouter()


@router.get(
    "/departments/",
    response_model=PaginatedResponse[DepartmentResponse],
    summary="Получение списка подразделений",
    description=(
        "Возвращает список подразделений с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает фильтрацию по лабораториям, поиск и сортировку."
    ),
    responses={200: {"description": "Список подразделений успешно получен"}},
)
# @IsAuthenticated
async def list_departments(
    db: DbSession,
    _effective: UserPermissions,
    filters: DepartmentListFiltersDep,
):
    departments, total = await get_departments(
        db,
        laboratory_id=filters.laboratory_id,
        page=filters.page,
        page_size=filters.page_size,
        search=filters.search,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
    )
    return build_paginated_response(departments, total, filters.page, filters.page_size)


@router.get(
    "/departments/by-laboratory/",
    response_model=list[DepartmentResponse],
    summary="Получение подразделений по лаборатории",
    description="Возвращает список подразделений для указанной лаборатории.",
    responses={200: {"description": "Список подразделений успешно получен"}},
)
# @IsAuthenticated
async def get_departments_by_laboratory(
    db: DbSession,
    _effective: UserPermissions,
    laboratory_id: int = Query(..., description="ID лаборатории"),
):
    departments, _ = await get_departments(db, laboratory_id=laboratory_id)
    return departments


@router.post(
    "/departments/",
    response_model=DepartmentResponse,
    status_code=201,
    summary="Добавление нового подразделения",
    description="Добавляет новое подразделение. Доступно только admin.",
    responses={
        201: {"description": "Подразделение успешно добавлено"},
        400: {"description": "Некорректные данные для добавления подразделения"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def create_department(
    department_data: DepartmentCreate,
    db: DbSession,
    effective: UserPermissions,
):
    require_admin(effective)
    return await create_department_service(db, department_data)


@router.patch(
    "/departments/{department_id:int}/",
    response_model=DepartmentResponse,
    summary="Обновление подразделения",
    description="Обновляет существующее подразделение.",
    responses={
        200: {"description": "Подразделение успешно обновлено"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Подразделение не найдено"},
    },
)
# @IsAuthenticated
async def update_department(
    department_id: int,
    department_data: DepartmentUpdate,
    db: DbSession,
    effective: UserPermissions,
):
    department = await require_department_by_id(db, department_id)
    lab_id = department.laboratory_id
    enforce_lab_management_access(effective, lab_id, department_id)
    return await update_department_service(db, department, department_data)


@router.delete(
    "/departments/{department_id:int}/",
    status_code=204,
    summary="Удаление подразделения",
    description="Выполняет мягкое удаление подразделения. Доступно только admin.",
    responses={
        204: {"description": "Подразделение успешно удалено"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Подразделение не найдено"},
    },
)
# @IsAuthenticated
async def delete_department(
    department_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> None:
    require_admin(effective)
    await delete_department_service(db, department_id)
