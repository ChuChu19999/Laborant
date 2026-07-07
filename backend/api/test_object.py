from __future__ import annotations
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from core.auth_decorators import IsAuthenticated
from core.database import get_db
from core.exceptions import NotFoundError
from schemas.pagination import PaginatedResponse
from schemas.test_object import (
    TestObjectCreate,
    TestObjectResponse,
    TestObjectSelectItem,
    TestObjectUpdate,
)
from services.test_object import (
    create_test_object,
    delete_test_object,
    get_test_object_names,
    get_test_object_response,
    get_test_objects_list,
    get_test_objects_response_list,
    update_test_object,
)

router = APIRouter()


@router.get(
    "/test-objects/",
    response_model=PaginatedResponse[TestObjectResponse],
    summary="Получение списка объектов испытаний",
    description=(
        "Возвращает список объектов испытаний с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает поиск и сортировку."
    ),
    responses={200: {"description": "Список объектов испытаний успешно получен"}},
)
# @IsAuthenticated
async def list_test_objects(
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("asc"),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает список объектов испытаний с пагинацией или без."""
    items, total, total_pages = await get_test_objects_response_list(
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


@router.get(
    "/test-objects/select/",
    response_model=List[TestObjectSelectItem],
    summary="Получение объектов испытаний для селектов",
    description=(
        "Возвращает объекты испытаний с учетом области видимости. "
        "Удаленные записи не включаются."
    ),
    responses={200: {"description": "Список объектов испытаний успешно получен"}},
)
# @IsAuthenticated
async def list_test_objects_for_select(
    laboratory_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает объекты испытаний для выбора в формах."""
    items, _, _ = await get_test_objects_list(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        for_select=True,
    )
    return [TestObjectSelectItem(name=item.name, tag=item.tag) for item in items]


@router.get(
    "/test-objects/names/",
    response_model=List[str],
    summary="Получение наименований объектов испытаний",
    description="Возвращает наименования объектов испытаний для фильтров и обратной совместимости.",
    responses={200: {"description": "Список наименований успешно получен"}},
)
# @IsAuthenticated
async def list_test_object_names(
    laboratory_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает наименования объектов испытаний."""
    return await get_test_object_names(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
    )


@router.get(
    "/test-objects/{test_object_id}/",
    response_model=TestObjectResponse,
    summary="Получение объекта испытаний по ID",
    description="Возвращает информацию об объекте испытаний по его идентификатору.",
    responses={
        200: {"description": "Объект испытаний успешно получен"},
        404: {"description": "Объект испытаний не найден"},
    },
)
# @IsAuthenticated
async def get_test_object_endpoint(
    test_object_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Возвращает информацию об объекте испытаний по его идентификатору."""
    item = await get_test_object_response(db, test_object_id)
    if not item:
        raise NotFoundError("Объект испытаний не найден")
    return item


@router.post(
    "/test-objects/",
    response_model=TestObjectResponse,
    status_code=201,
    summary="Добавление объекта испытаний",
    description="Добавляет новый объект испытаний на основе переданных данных.",
    responses={
        201: {"description": "Объект испытаний успешно добавлен"},
        400: {"description": "Некорректные данные для добавления объекта испытаний"},
    },
)
# @IsAuthenticated
async def create_test_object_endpoint(
    data: TestObjectCreate,
    db: AsyncSession = Depends(get_db),
):
    """Добавляет новый объект испытаний на основе переданных данных."""
    return await create_test_object(db, data)


@router.patch(
    "/test-objects/{test_object_id}/",
    response_model=TestObjectResponse,
    summary="Обновление объекта испытаний",
    description="Обновляет существующий объект испытаний.",
    responses={
        200: {"description": "Объект испытаний успешно обновлен"},
        404: {"description": "Объект испытаний не найден"},
    },
)
# @IsAuthenticated
async def update_test_object_endpoint(
    test_object_id: int,
    data: TestObjectUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Обновляет существующий объект испытаний."""
    return await update_test_object(db, test_object_id, data)


@router.delete(
    "/test-objects/{test_object_id}/",
    status_code=204,
    summary="Удаление объекта испытаний",
    description=("Выполняет мягкое удаление объекта испытаний."),
    responses={
        204: {"description": "Объект испытаний успешно удален"},
        404: {"description": "Объект испытаний не найден"},
    },
)
# @IsAuthenticated
async def delete_test_object_endpoint(
    test_object_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Выполняет мягкое удаление объекта испытаний."""
    await delete_test_object(db, test_object_id)
