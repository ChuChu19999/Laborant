from __future__ import annotations
from fastapi import APIRouter, Query
from core.auth_decorators import IsAuthenticated
from core.deps import DbSession, UserPermissions
from schemas.laboratory import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
)
from schemas.pagination import PaginatedResponse
from services.access_control import enforce_lab_management_access
from services.laboratory import build_department_response
from services.laboratory import create_department as create_department_service
from services.laboratory import delete_department as delete_department_service
from services.laboratory import get_departments, require_department_by_id
from services.laboratory import update_department as update_department_service

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
    effective: UserPermissions,
    laboratory_id: int | None = Query(None),
    page: int | None = Query(None, ge=1),
    page_size: int | None = Query(None, ge=1, le=100),
    search: str | None = Query(None),
    sort_by: str | None = Query(None),
    sort_order: str | None = Query("desc"),
):
    """Возвращает список подразделений с пагинацией или без."""
    departments, total, total_pages = await get_departments(
        db,
        laboratory_id=laboratory_id,
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    items = [build_department_response(dept) for dept in departments]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page if page is not None else 1,
        page_size=page_size if page_size is not None else total,
        total_pages=total_pages,
    )


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
    effective: UserPermissions,
    laboratory_id: int = Query(..., description="ID лаборатории"),
):
    """Возвращает список подразделений для указанной лаборатории."""
    departments, _, _ = await get_departments(db, laboratory_id=laboratory_id)
    items = [build_department_response(dept) for dept in departments]
    return items


@router.post(
    "/departments/",
    response_model=DepartmentResponse,
    status_code=201,
    summary="Добавление нового подразделения",
    description="Добавляет новое подразделение на основе переданных данных.",
    responses={
        201: {"description": "Подразделение успешно добавлено"},
        400: {"description": "Некорректные данные для добавления подразделения"},
    },
)
# @IsAuthenticated
async def create_department(
    department_data: DepartmentCreate,
    db: DbSession,
    effective: UserPermissions,
):
    """Добавляет новое подразделение на основе переданных данных."""
    enforce_lab_management_access(effective, department_data.laboratory_id)
    department = await create_department_service(db, department_data)
    return DepartmentResponse.model_validate(department)


@router.patch(
    "/departments/{department_id}/",
    response_model=DepartmentResponse,
    summary="Обновление подразделения",
    description="Обновляет существующее подразделение.",
    responses={
        200: {"description": "Подразделение успешно обновлено"},
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
    """Обновляет существующее подразделение."""
    department = await require_department_by_id(db, department_id)
    lab_id = department.laboratory_id
    enforce_lab_management_access(effective, lab_id, department_id)
    department = await update_department_service(db, department_id, department_data)
    return DepartmentResponse.model_validate(department)


@router.delete(
    "/departments/{department_id}/",
    status_code=204,
    summary="Удаление подразделения",
    description="Выполняет мягкое удаление подразделения.",
    responses={
        204: {"description": "Подразделение успешно удалено"},
        404: {"description": "Подразделение не найдено"},
    },
)
# @IsAuthenticated
async def delete_department(
    department_id: int,
    db: DbSession,
    effective: UserPermissions,
):
    """Выполняет мягкое удаление подразделения."""
    department = await require_department_by_id(db, department_id)
    enforce_lab_management_access(effective, department.laboratory_id, department_id)
    await delete_department_service(db, department_id)
