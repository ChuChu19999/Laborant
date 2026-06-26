from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.exceptions import NotFoundError
from core.security import IsAuthenticated
from schemas.nd_norm import NdNormCreate, NdNormResponse, NdNormUpdate
from schemas.pagination import PaginatedResponse
from services.nd_norm import (
    create_nd_norm,
    delete_nd_norm,
    get_nd_norm_by_id,
    get_nd_norms_list,
    update_nd_norm,
)
from utils.query_params import parse_date_range_params

router = APIRouter()


def _to_response(nd_norm) -> NdNormResponse:
    response_data = NdNormResponse.model_validate(nd_norm).model_dump()
    if nd_norm.laboratory:
        response_data["laboratory_name"] = nd_norm.laboratory.name
    if nd_norm.department:
        response_data["department_name"] = nd_norm.department.name
    return NdNormResponse(**response_data)


@router.get(
    "/nd-norms/",
    response_model=PaginatedResponse[NdNormResponse],
    summary="Получение списка норм НД",
    description=(
        "Возвращает список норм НД с пагинацией или без. "
        "Поддерживает фильтрацию по лаборатории и подразделению, поиск и сортировку."
    ),
    responses={200: {"description": "Список норм НД успешно получен"}},
)
# @IsAuthenticated
async def list_nd_norms(
    laboratory_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
    search: Optional[str] = Query(None),
    test_object: Optional[str] = Query(None),
    test_objects: Optional[List[str]] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
    created_at_from: Optional[str] = Query(None),
    created_at_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает список норм НД с пагинацией или без."""
    created_at_from_parsed, created_at_to_parsed = parse_date_range_params(
        created_at_from, created_at_to
    )

    nd_norms_list, total, total_pages = await get_nd_norms_list(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        page=page,
        page_size=page_size,
        search=search,
        test_object=test_object,
        test_objects=test_objects,
        sort_by=sort_by,
        sort_order=sort_order,
        created_at_from=created_at_from_parsed,
        created_at_to=created_at_to_parsed,
    )

    items = [_to_response(item) for item in nd_norms_list]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page if page is not None else 1,
        page_size=page_size if page_size is not None else total,
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
    db: AsyncSession = Depends(get_db),
):
    """Добавляет новую норму НД на основе переданных данных."""
    nd_norm = await create_nd_norm(db, nd_norm_data)
    await db.commit()
    return _to_response(nd_norm)


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
    db: AsyncSession = Depends(get_db),
):
    """Возвращает информацию о норме НД по ее идентификатору."""
    nd_norm = await get_nd_norm_by_id(db, nd_norm_id)
    if not nd_norm:
        raise NotFoundError("Норма НД не найдена")
    return _to_response(nd_norm)


@router.patch(
    "/nd-norms/{nd_norm_id}/",
    response_model=NdNormResponse,
    summary="Обновление нормы НД",
    description="Обновляет существующую норму НД. Можно обновить только указанные поля.",
    responses={
        200: {"description": "Норма НД успешно обновлена"},
        404: {"description": "Норма НД не найдена"},
    },
)
# @IsAuthenticated
async def update_nd_norm_endpoint(
    nd_norm_id: int,
    nd_norm_data: NdNormUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Обновляет существующую норму НД. Можно обновить только указанные поля."""
    nd_norm = await update_nd_norm(db, nd_norm_id, nd_norm_data)
    await db.commit()
    return _to_response(nd_norm)


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
    db: AsyncSession = Depends(get_db),
):
    """Выполняет мягкое удаление нормы НД."""
    await delete_nd_norm(db, nd_norm_id)
    await db.commit()
