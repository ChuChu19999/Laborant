from __future__ import annotations
from fastapi import APIRouter, Depends
from core.deps import DbSession, NdNormListFilters, UserPermissions
from schemas.nd_norm import NdNormCreate, NdNormResponse, NdNormUpdate
from schemas.pagination import PaginatedResponse
from services.access_control import enforce_crud_access
from services.nd_norm import (
    build_nd_norm_response,
    create_nd_norm,
    delete_nd_norm,
    get_nd_norms,
    require_nd_norm_by_id,
    update_nd_norm,
)

router = APIRouter()


@router.get(
    "/nd-norms/",
    response_model=PaginatedResponse[NdNormResponse],
    summary="Получение списка норм НД",
    description=(
        "Возвращает список норм НД с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает фильтрацию по лаборатории и подразделению, поиск и сортировку."
    ),
    responses={200: {"description": "Список норм НД успешно получен"}},
)
# @IsAuthenticated
async def list_nd_norms(
    db: DbSession,
    effective: UserPermissions,
    filters: NdNormListFilters = Depends(),
):
    """Возвращает список норм НД с пагинацией или без."""
    enforce_crud_access(
        effective,
        "nd_norms",
        "read",
        filters.laboratory_id,
        filters.department_id,
    )
    nd_norms_list, total, total_pages = await get_nd_norms(
        db,
        laboratory_id=filters.laboratory_id,
        department_id=filters.department_id,
        page=filters.page,
        page_size=filters.page_size,
        search=filters.search,
        test_object=filters.test_object,
        test_objects=filters.test_objects,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
        created_at_from=filters.created_at_from,
        created_at_to=filters.created_at_to,
    )

    items = [build_nd_norm_response(item) for item in nd_norms_list]

    return PaginatedResponse(
        items=items,
        total=total,
        page=filters.page if filters.page is not None else 1,
        page_size=filters.page_size if filters.page_size is not None else total,
        total_pages=total_pages,
    )


@router.post(
    "/nd-norms/",
    response_model=NdNormResponse,
    status_code=201,
    summary="Добавление новой нормы НД",
    description="Добавляет новую норму НД на основе переданных данных.",
    responses={
        201: {"description": "Норма НД успешно добавлена"},
        400: {"description": "Некорректные данные для добавления нормы НД"},
    },
)
# @IsAuthenticated
async def create_nd_norm_endpoint(
    nd_norm_data: NdNormCreate,
    db: DbSession,
    effective: UserPermissions,
):
    """Добавляет новую норму НД на основе переданных данных."""
    enforce_crud_access(
        effective,
        "nd_norms",
        "create",
        nd_norm_data.laboratory_id,
        nd_norm_data.department_id,
    )
    nd_norm = await create_nd_norm(db, nd_norm_data)
    return build_nd_norm_response(nd_norm)


@router.get(
    "/nd-norms/{nd_norm_id}/",
    response_model=NdNormResponse,
    summary="Получение нормы НД по ID",
    description="Возвращает информацию о норме НД по ее идентификатору.",
    responses={
        200: {"description": "Норма НД успешно получена"},
        404: {"description": "Норма НД не найдена"},
    },
)
# @IsAuthenticated
async def get_nd_norm(
    nd_norm_id: int,
    db: DbSession,
    effective: UserPermissions,
):
    """Возвращает информацию о норме НД по ее идентификатору."""
    nd_norm = await require_nd_norm_by_id(db, nd_norm_id)
    enforce_crud_access(
        effective,
        "nd_norms",
        "read",
        nd_norm.laboratory_id,
        nd_norm.department_id,
    )
    return build_nd_norm_response(nd_norm)


@router.patch(
    "/nd-norms/{nd_norm_id}/",
    response_model=NdNormResponse,
    summary="Обновление нормы НД",
    description="Обновляет существующую норму НД.",
    responses={
        200: {"description": "Норма НД успешно обновлена"},
        404: {"description": "Норма НД не найдена"},
    },
)
# @IsAuthenticated
async def update_nd_norm_endpoint(
    nd_norm_id: int,
    nd_norm_data: NdNormUpdate,
    db: DbSession,
    effective: UserPermissions,
):
    """Обновляет существующую норму НД."""
    existing = await require_nd_norm_by_id(db, nd_norm_id)
    lab_id = nd_norm_data.laboratory_id or existing.laboratory_id
    dept_id = nd_norm_data.department_id or existing.department_id
    enforce_crud_access(effective, "nd_norms", "update", lab_id, dept_id)
    nd_norm = await update_nd_norm(db, nd_norm_id, nd_norm_data)
    return build_nd_norm_response(nd_norm)


@router.delete(
    "/nd-norms/{nd_norm_id}/",
    status_code=204,
    summary="Удаление нормы НД",
    description="Выполняет мягкое удаление нормы НД.",
    responses={
        204: {"description": "Норма НД успешно удалена"},
        404: {"description": "Норма НД не найдена"},
    },
)
# @IsAuthenticated
async def delete_nd_norm_endpoint(
    nd_norm_id: int,
    db: DbSession,
    effective: UserPermissions,
):
    """Выполняет мягкое удаление нормы НД."""
    nd_norm = await require_nd_norm_by_id(db, nd_norm_id)
    enforce_crud_access(
        effective,
        "nd_norms",
        "delete",
        nd_norm.laboratory_id,
        nd_norm.department_id,
    )
    await delete_nd_norm(db, nd_norm_id)
