from __future__ import annotations
from fastapi import APIRouter
from core.deps import BranchListFiltersDep, DbSession, UserPermissions
from schemas.test_purpose import TestPurposeCreate, TestPurposeResponse, TestPurposeUpdate
from services.access_control import enforce_crud_access
from services.test_purpose import (
    create_test_purpose,
    delete_test_purpose,
    get_test_purposes,
    require_test_purpose_by_id,
    resolve_test_purpose_update_scope,
    update_test_purpose,
)

router = APIRouter()


@router.get(
    "/test-purposes/",
    response_model=list[TestPurposeResponse],
    summary="Получение списка целей испытаний",
    description="Возвращает справочник целей испытаний. Фильтруется по лаборатории и подразделению.",
    responses={200: {"description": "Список целей испытаний успешно получен"}},
)
# @IsAuthenticated
async def list_test_purposes(
    db: DbSession,
    effective: UserPermissions,
    filters: BranchListFiltersDep,
):
    enforce_crud_access(effective, "test_purposes", "read", filters.laboratory_id, filters.department_id)
    return await get_test_purposes(
        db,
        laboratory_id=filters.laboratory_id,
        department_id=filters.department_id,
        search=filters.search,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
    )


@router.post(
    "/test-purposes/",
    response_model=TestPurposeResponse,
    status_code=201,
    summary="Добавление цели испытаний",
    description="Добавляет новую цель испытаний в справочник лаборатории/подразделения.",
    responses={
        201: {"description": "Цель испытаний успешно добавлена"},
        403: {"description": "Отказано в доступе"},
        409: {"description": "Цель испытаний с таким названием уже существует"},
    },
)
# @IsAuthenticated
async def create_test_purpose_endpoint(
    data: TestPurposeCreate,
    db: DbSession,
    effective: UserPermissions,
):
    enforce_crud_access(effective, "test_purposes", "create", data.laboratory_id, data.department_id)
    return await create_test_purpose(db, data)


@router.get(
    "/test-purposes/{test_purpose_id:int}/",
    response_model=TestPurposeResponse,
    summary="Получение цели испытаний по ID",
    description="Возвращает цель испытаний по идентификатору.",
    responses={
        200: {"description": "Цель испытаний успешно получена"},
        404: {"description": "Цель испытаний не найдена"},
    },
)
# @IsAuthenticated
async def get_test_purpose(
    test_purpose_id: int,
    db: DbSession,
    effective: UserPermissions,
):
    test_purpose = await require_test_purpose_by_id(db, test_purpose_id)
    enforce_crud_access(effective, "test_purposes", "read", test_purpose.laboratory_id, test_purpose.department_id)
    return test_purpose


@router.patch(
    "/test-purposes/{test_purpose_id:int}/",
    response_model=TestPurposeResponse,
    summary="Обновление цели испытаний",
    description="Обновляет существующую цель испытаний.",
    responses={
        200: {"description": "Цель испытаний успешно обновлена"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Цель испытаний не найдена"},
    },
)
# @IsAuthenticated
async def update_test_purpose_endpoint(
    test_purpose_id: int,
    data: TestPurposeUpdate,
    db: DbSession,
    effective: UserPermissions,
):
    test_purpose = await require_test_purpose_by_id(db, test_purpose_id)
    laboratory_id, department_id = resolve_test_purpose_update_scope(test_purpose, data)
    enforce_crud_access(effective, "test_purposes", "update", laboratory_id, department_id)
    return await update_test_purpose(db, test_purpose, data)


@router.delete(
    "/test-purposes/{test_purpose_id:int}/",
    status_code=204,
    summary="Удаление цели испытаний",
    description="Выполняет мягкое удаление цели испытаний.",
    responses={
        204: {"description": "Цель испытаний успешно удалена"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Цель испытаний не найдена"},
    },
)
# @IsAuthenticated
async def delete_test_purpose_endpoint(
    test_purpose_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> None:
    test_purpose = await require_test_purpose_by_id(db, test_purpose_id)
    enforce_crud_access(
        effective,
        "test_purposes",
        "delete",
        test_purpose.laboratory_id,
        test_purpose.department_id,
    )
    await delete_test_purpose(db, test_purpose)
