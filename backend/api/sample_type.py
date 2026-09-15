from __future__ import annotations
from fastapi import APIRouter
from core.deps import BranchListFiltersDep, DbSession, UserPermissions
from schemas.sample_type import SampleTypeCreate, SampleTypeResponse, SampleTypeUpdate
from services.access_control import enforce_crud_access
from services.sample_type import (
    create_sample_type,
    delete_sample_type,
    get_sample_types,
    require_sample_type_by_id,
    resolve_sample_type_update_scope,
    update_sample_type,
)

router = APIRouter()


@router.get(
    "/sample-types/",
    response_model=list[SampleTypeResponse],
    summary="Получение списка типов проб",
    description="Возвращает справочник типов проб. Фильтруется по лаборатории и подразделению.",
    responses={200: {"description": "Список типов проб успешно получен"}},
)
# @IsAuthenticated
async def list_sample_types(
    db: DbSession,
    effective: UserPermissions,
    filters: BranchListFiltersDep,
):
    enforce_crud_access(effective, "sample_types", "read", filters.laboratory_id, filters.department_id)
    return await get_sample_types(
        db,
        laboratory_id=filters.laboratory_id,
        department_id=filters.department_id,
        search=filters.search,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
    )


@router.post(
    "/sample-types/",
    response_model=SampleTypeResponse,
    status_code=201,
    summary="Добавление типа пробы",
    description="Добавляет новый тип пробы в справочник лаборатории/подразделения.",
    responses={
        201: {"description": "Тип пробы успешно добавлен"},
        403: {"description": "Отказано в доступе"},
        409: {"description": "Тип пробы с таким названием уже существует"},
    },
)
# @IsAuthenticated
async def create_sample_type_endpoint(
    data: SampleTypeCreate,
    db: DbSession,
    effective: UserPermissions,
):
    enforce_crud_access(effective, "sample_types", "create", data.laboratory_id, data.department_id)
    return await create_sample_type(db, data)


@router.get(
    "/sample-types/{sample_type_id:int}/",
    response_model=SampleTypeResponse,
    summary="Получение типа пробы по ID",
    description="Возвращает тип пробы по идентификатору.",
    responses={
        200: {"description": "Тип пробы успешно получен"},
        404: {"description": "Тип пробы не найден"},
    },
)
# @IsAuthenticated
async def get_sample_type(
    sample_type_id: int,
    db: DbSession,
    effective: UserPermissions,
):
    sample_type = await require_sample_type_by_id(db, sample_type_id)
    enforce_crud_access(effective, "sample_types", "read", sample_type.laboratory_id, sample_type.department_id)
    return sample_type


@router.patch(
    "/sample-types/{sample_type_id:int}/",
    response_model=SampleTypeResponse,
    summary="Обновление типа пробы",
    description="Обновляет существующий тип пробы.",
    responses={
        200: {"description": "Тип пробы успешно обновлён"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Тип пробы не найден"},
    },
)
# @IsAuthenticated
async def update_sample_type_endpoint(
    sample_type_id: int,
    data: SampleTypeUpdate,
    db: DbSession,
    effective: UserPermissions,
):
    sample_type = await require_sample_type_by_id(db, sample_type_id)
    laboratory_id, department_id = resolve_sample_type_update_scope(sample_type, data)
    enforce_crud_access(effective, "sample_types", "update", laboratory_id, department_id)
    return await update_sample_type(db, sample_type, data)


@router.delete(
    "/sample-types/{sample_type_id:int}/",
    status_code=204,
    summary="Удаление типа пробы",
    description="Выполняет мягкое удаление типа пробы.",
    responses={
        204: {"description": "Тип пробы успешно удалён"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Тип пробы не найден"},
    },
)
# @IsAuthenticated
async def delete_sample_type_endpoint(
    sample_type_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> None:
    sample_type = await require_sample_type_by_id(db, sample_type_id)
    enforce_crud_access(effective, "sample_types", "delete", sample_type.laboratory_id, sample_type.department_id)
    await delete_sample_type(db, sample_type)
