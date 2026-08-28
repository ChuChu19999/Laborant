from __future__ import annotations
from fastapi import APIRouter
from core.deps import DbSession, PaginationSearchSortDep, UserPermissions, require_admin
from schemas.laboratory import LaboratoryCreate, LaboratoryResponse, LaboratoryUpdate
from schemas.pagination import PaginatedResponse, build_paginated_response
from services.access_control import enforce_lab_management_access
from services.laboratory import (
    create_laboratory as create_laboratory_service,
    delete_laboratory as delete_laboratory_service,
    get_laboratories,
    require_laboratory_by_id,
    update_laboratory as update_laboratory_service,
)

router = APIRouter()


@router.get(
    "/laboratories/",
    response_model=PaginatedResponse[LaboratoryResponse],
    summary="Получение списка лабораторий",
    description=(
        "Возвращает список лабораторий с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает поиск и сортировку."
    ),
    responses={200: {"description": "Список лабораторий успешно получен"}},
)
# @IsAuthenticated
async def list_laboratories(
    db: DbSession,
    _effective: UserPermissions,
    filters: PaginationSearchSortDep,
):
    items, total = await get_laboratories(
        db,
        page=filters.page,
        page_size=filters.page_size,
        search=filters.search,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
    )
    return build_paginated_response(items, total, filters.page, filters.page_size)


@router.post(
    "/laboratories/",
    response_model=LaboratoryResponse,
    status_code=201,
    summary="Добавление новой лаборатории",
    description="Добавляет новую лабораторию. Доступно только admin.",
    responses={
        201: {"description": "Лаборатория успешно добавлена"},
        400: {"description": "Некорректные данные для добавления лаборатории"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def create_laboratory(
    laboratory_data: LaboratoryCreate,
    db: DbSession,
    effective: UserPermissions,
):
    require_admin(effective)
    return await create_laboratory_service(db, laboratory_data)


@router.get(
    "/laboratories/{laboratory_id:int}/",
    response_model=LaboratoryResponse,
    summary="Получение лаборатории по ID",
    description="Возвращает информацию о лаборатории по её идентификатору.",
    responses={
        200: {"description": "Лаборатория успешно получена"},
        404: {"description": "Лаборатория не найдена"},
    },
)
# @IsAuthenticated
async def get_laboratory(
    laboratory_id: int,
    db: DbSession,
    _effective: UserPermissions,
):
    return await require_laboratory_by_id(db, laboratory_id)


@router.patch(
    "/laboratories/{laboratory_id:int}/",
    response_model=LaboratoryResponse,
    summary="Обновление лаборатории",
    description="Обновляет существующую лабораторию.",
    responses={
        200: {"description": "Лаборатория успешно обновлена"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Лаборатория не найдена"},
    },
)
# @IsAuthenticated
async def update_laboratory(
    laboratory_id: int,
    laboratory_data: LaboratoryUpdate,
    db: DbSession,
    effective: UserPermissions,
):
    laboratory = await require_laboratory_by_id(db, laboratory_id)
    enforce_lab_management_access(effective, laboratory_id)
    return await update_laboratory_service(db, laboratory, laboratory_data)


@router.delete(
    "/laboratories/{laboratory_id:int}/",
    status_code=204,
    summary="Удаление лаборатории",
    description="Выполняет мягкое удаление лаборатории. Доступно только admin.",
    responses={
        204: {"description": "Лаборатория успешно удалена"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Лаборатория не найдена"},
    },
)
# @IsAuthenticated
async def delete_laboratory(
    laboratory_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> None:
    require_admin(effective)
    await delete_laboratory_service(db, laboratory_id)
