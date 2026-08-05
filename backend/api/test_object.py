from __future__ import annotations
from fastapi import APIRouter, Query
from core.auth_decorators import IsAuthenticated
from core.deps import DbSession, UserPermissions, require_admin
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
from services.user_permissions import require_scope_access

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
    db: DbSession,
    effective: UserPermissions,
    page: int | None = Query(None, ge=1),
    page_size: int | None = Query(None, ge=1, le=100),
    search: str | None = Query(None),
    sort_by: str | None = Query(None),
    sort_order: str | None = Query("asc"),
):
    """Возвращает список объектов испытаний с пагинацией или без."""
    require_admin(effective)
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
    response_model=list[TestObjectSelectItem],
    summary="Получение объектов испытаний для селектов",
    description=(
        "Возвращает объекты испытаний с учетом области видимости. "
        "Удаленные записи не включаются."
    ),
    responses={200: {"description": "Список объектов испытаний успешно получен"}},
)
# @IsAuthenticated
async def list_test_objects_for_select(
    db: DbSession,
    effective: UserPermissions,
    laboratory_id: int | None = Query(None),
    department_id: int | None = Query(None),
):
    """Возвращает объекты испытаний для выбора в формах."""
    require_scope_access(effective, laboratory_id, department_id)
    items, _, _ = await get_test_objects_list(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        for_select=True,
    )
    return [TestObjectSelectItem(name=item.name, tag=item.tag) for item in items]


@router.get(
    "/test-objects/names/",
    response_model=list[str],
    summary="Получение наименований объектов испытаний",
    description="Возвращает наименования объектов испытаний для фильтров и обратной совместимости.",
    responses={200: {"description": "Список наименований успешно получен"}},
)
# @IsAuthenticated
async def list_test_object_names(
    db: DbSession,
    effective: UserPermissions,
    laboratory_id: int | None = Query(None),
    department_id: int | None = Query(None),
):
    """Возвращает наименования объектов испытаний."""
    require_scope_access(effective, laboratory_id, department_id)
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
    db: DbSession,
    effective: UserPermissions,
):
    """Возвращает информацию об объекте испытаний по его идентификатору."""
    require_admin(effective)
    return await get_test_object_response(db, test_object_id)


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
    db: DbSession,
    effective: UserPermissions,
):
    """Добавляет новый объект испытаний на основе переданных данных."""
    require_admin(effective)
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
    db: DbSession,
    effective: UserPermissions,
):
    """Обновляет существующий объект испытаний."""
    require_admin(effective)
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
    db: DbSession,
    effective: UserPermissions,
):
    """Выполняет мягкое удаление объекта испытаний."""
    require_admin(effective)
    await delete_test_object(db, test_object_id)
