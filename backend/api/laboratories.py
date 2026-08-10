from __future__ import annotations
from fastapi import APIRouter, Query
from core.deps import DbSession, UserPermissions, require_admin
from schemas.laboratory import (
    LaboratoryCreate,
    LaboratoryResponse,
    LaboratoryUpdate,
)
from schemas.pagination import PaginatedResponse
from services.access_control import enforce_lab_management_access
from services.laboratory import (
    create_laboratory as create_laboratory_service,
    delete_laboratory as delete_laboratory_service,
    get_laboratories_response_data,
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
    effective: UserPermissions,
    page: int | None = Query(None, ge=1),
    page_size: int | None = Query(None, ge=1, le=100),
    search: str | None = Query(None),
    sort_by: str | None = Query(None),
    sort_order: str | None = Query("desc"),
):
    """Возвращает список лабораторий с пагинацией или без."""
    items, total, total_pages = await get_laboratories_response_data(
        db,
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    return PaginatedResponse(
        items=items,
        total=total,
        page=page if page is not None else 1,
        page_size=page_size if page_size is not None else total,
        total_pages=total_pages,
    )


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
    """Добавляет новую лабораторию. Только admin."""
    require_admin(effective)
    laboratory = await create_laboratory_service(db, laboratory_data)
    return LaboratoryResponse.model_validate(laboratory)


@router.get(
    "/laboratories/{laboratory_id:int}/",
    response_model=LaboratoryResponse,
    summary="Получение лаборатории по ID",
    description="Возвращает информацию о лаборатории по ее идентификатору.",
    responses={
        200: {"description": "Лаборатория успешно получена"},
        404: {"description": "Лаборатория не найдена"},
    },
)
# @IsAuthenticated
async def get_laboratory(
    laboratory_id: int,
    db: DbSession,
    effective: UserPermissions,
):
    """Возвращает информацию о лаборатории по ее идентификатору."""
    laboratory = await require_laboratory_by_id(db, laboratory_id)
    return LaboratoryResponse.model_validate(laboratory)


@router.patch(
    "/laboratories/{laboratory_id:int}/",
    response_model=LaboratoryResponse,
    summary="Обновление лаборатории",
    description="Обновляет существующую лабораторию.",
    responses={
        200: {"description": "Лаборатория успешно обновлена"},
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
    """Обновляет существующую лабораторию."""
    enforce_lab_management_access(effective, laboratory_id)
    laboratory = await update_laboratory_service(db, laboratory_id, laboratory_data)
    return LaboratoryResponse.model_validate(laboratory)


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
):
    """Выполняет мягкое удаление лаборатории. Только admin."""
    require_admin(effective)
    await delete_laboratory_service(db, laboratory_id)
