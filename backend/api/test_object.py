from __future__ import annotations
from fastapi import APIRouter
from core.deps import (
    DbSession,
    TestObjectListFiltersDep,
    TestObjectSelectFiltersDep,
    UserPermissions,
    require_admin,
)
from schemas.pagination import PaginatedResponse, build_paginated_response
from schemas.test_object import (
    TestObjectCreate,
    TestObjectResponse,
    TestObjectSelectItem,
    TestObjectUpdate,
)
from services.test_object import (
    create_test_object_for_response,
    delete_test_object,
    get_test_object_for_response,
    get_test_object_names,
    get_test_objects_for_response,
    get_test_objects_for_select,
    update_test_object_for_response,
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
    responses={
        200: {"description": "Список объектов испытаний успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def list_test_objects(
    db: DbSession,
    effective: UserPermissions,
    filters: TestObjectListFiltersDep,
):
    require_admin(effective)
    items, total = await get_test_objects_for_response(
        db,
        page=filters.page,
        page_size=filters.page_size,
        search=filters.search,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
    )
    return build_paginated_response(items, total, filters.page, filters.page_size)


@router.get(
    "/test-objects/select/",
    response_model=list[TestObjectSelectItem],
    summary="Получение объектов испытаний для селектов",
    description=("Возвращает объекты испытаний с учётом области видимости. Удалённые записи не включаются."),
    responses={
        200: {"description": "Список объектов испытаний успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def list_test_objects_for_select(
    db: DbSession,
    effective: UserPermissions,
    filters: TestObjectSelectFiltersDep,
) -> list[TestObjectSelectItem]:
    require_scope_access(effective, filters.laboratory_id, filters.department_id)
    return await get_test_objects_for_select(
        db,
        laboratory_id=filters.laboratory_id,
        department_id=filters.department_id,
    )


@router.get(
    "/test-objects/names/",
    response_model=list[str],
    summary="Получение наименований объектов испытаний",
    description="Возвращает наименования объектов испытаний для фильтров и обратной совместимости.",
    responses={
        200: {"description": "Список наименований успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def list_test_object_names(
    db: DbSession,
    effective: UserPermissions,
    filters: TestObjectSelectFiltersDep,
) -> list[str]:
    require_scope_access(effective, filters.laboratory_id, filters.department_id)
    return await get_test_object_names(
        db,
        laboratory_id=filters.laboratory_id,
        department_id=filters.department_id,
    )


@router.get(
    "/test-objects/{test_object_id:int}/",
    response_model=TestObjectResponse,
    summary="Получение объекта испытаний по ID",
    description="Возвращает информацию об объекте испытаний по его идентификатору.",
    responses={
        200: {"description": "Объект испытаний успешно получен"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Объект испытаний не найден"},
    },
)
# @IsAuthenticated
async def get_test_object_endpoint(
    test_object_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> TestObjectResponse:
    require_admin(effective)
    return await get_test_object_for_response(db, test_object_id)


@router.post(
    "/test-objects/",
    response_model=TestObjectResponse,
    status_code=201,
    summary="Добавление объекта испытаний",
    description="Добавляет новый объект испытаний на основе переданных данных.",
    responses={
        201: {"description": "Объект испытаний успешно добавлен"},
        400: {"description": "Некорректные данные для добавления объекта испытаний"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def create_test_object_endpoint(
    data: TestObjectCreate,
    db: DbSession,
    effective: UserPermissions,
) -> TestObjectResponse:
    require_admin(effective)
    return await create_test_object_for_response(db, data)


@router.patch(
    "/test-objects/{test_object_id:int}/",
    response_model=TestObjectResponse,
    summary="Обновление объекта испытаний",
    description="Обновляет существующий объект испытаний.",
    responses={
        200: {"description": "Объект испытаний успешно обновлен"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Объект испытаний не найден"},
    },
)
# @IsAuthenticated
async def update_test_object_endpoint(
    test_object_id: int,
    data: TestObjectUpdate,
    db: DbSession,
    effective: UserPermissions,
) -> TestObjectResponse:
    require_admin(effective)
    return await update_test_object_for_response(db, test_object_id, data)


@router.delete(
    "/test-objects/{test_object_id:int}/",
    status_code=204,
    summary="Удаление объекта испытаний",
    description=("Выполняет мягкое удаление объекта испытаний."),
    responses={
        204: {"description": "Объект испытаний успешно удалён"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Объект испытаний не найден"},
    },
)
# @IsAuthenticated
async def delete_test_object_endpoint(
    test_object_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> None:
    require_admin(effective)
    await delete_test_object(db, test_object_id)
