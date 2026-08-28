from __future__ import annotations
from fastapi import APIRouter
from core.deps import DbSession, EquipmentListFiltersDep, UserPermissions
from schemas.equipment import EquipmentCreate, EquipmentResponse, EquipmentUpdate
from schemas.pagination import PaginatedResponse, build_paginated_response
from services.access_control import enforce_crud_access
from services.equipment import (
    create_equipment,
    delete_equipment,
    get_equipment,
    require_equipment_by_id,
    resolve_equipment_update_scope,
    update_equipment,
)

router = APIRouter()


@router.get(
    "/equipment/",
    response_model=PaginatedResponse[EquipmentResponse],
    summary="Получение списка оборудования",
    description=(
        "Возвращает список оборудования с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает фильтрацию по лабораториям, подразделениям и типу оборудования, поиск и сортировку."
    ),
    responses={
        200: {"description": "Список оборудования успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def list_equipment(
    db: DbSession,
    effective: UserPermissions,
    filters: EquipmentListFiltersDep,
):
    enforce_crud_access(
        effective,
        "equipment",
        "read",
        filters.laboratory_id,
        filters.department_id,
    )
    equipment_list, total = await get_equipment(
        db,
        laboratory_id=filters.laboratory_id,
        department_id=filters.department_id,
        equipment_types=filters.equipment_types_list,
        page=filters.page,
        page_size=filters.page_size,
        search=filters.search,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
        verification_date_from=filters.verification_date_from,
        verification_date_to=filters.verification_date_to,
        verification_end_date_from=filters.verification_end_date_from,
        verification_end_date_to=filters.verification_end_date_to,
        created_at_from=filters.created_at_from,
        created_at_to=filters.created_at_to,
    )
    return build_paginated_response(equipment_list, total, filters.page, filters.page_size)


@router.post(
    "/equipment/",
    response_model=EquipmentResponse,
    status_code=201,
    summary="Добавление нового оборудования",
    description="Добавляет новое оборудование на основе переданных данных.",
    responses={
        201: {"description": "Оборудование успешно добавлено"},
        400: {"description": "Некорректные данные для добавления оборудования"},
        403: {"description": "Отказано в доступе"},
        409: {"description": "Оборудование с таким наименованием уже существует"},
    },
)
# @IsAuthenticated
async def create_equipment_endpoint(
    equipment_data: EquipmentCreate,
    db: DbSession,
    effective: UserPermissions,
):
    enforce_crud_access(
        effective,
        "equipment",
        "create",
        equipment_data.laboratory_id,
        equipment_data.department_id,
    )
    return await create_equipment(db, equipment_data)


@router.get(
    "/equipment/{equipment_id:int}/",
    response_model=EquipmentResponse,
    summary="Получение оборудования по ID",
    description="Возвращает информацию об оборудовании по его идентификатору.",
    responses={
        200: {"description": "Оборудование успешно получено"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Оборудование не найдено"},
    },
)
# @IsAuthenticated
async def get_equipment_endpoint(
    equipment_id: int,
    db: DbSession,
    effective: UserPermissions,
):
    equipment = await require_equipment_by_id(db, equipment_id)
    enforce_crud_access(
        effective,
        "equipment",
        "read",
        equipment.laboratory_id,
        equipment.department_id,
    )
    return equipment


@router.patch(
    "/equipment/{equipment_id:int}/",
    response_model=EquipmentResponse,
    summary="Обновление оборудования",
    description="Обновляет существующее оборудование.",
    responses={
        200: {"description": "Оборудование успешно обновлено"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Оборудование не найдено"},
        409: {"description": "Оборудование с таким наименованием уже существует"},
    },
)
# @IsAuthenticated
async def update_equipment_endpoint(
    equipment_id: int,
    equipment_data: EquipmentUpdate,
    db: DbSession,
    effective: UserPermissions,
):
    existing = await require_equipment_by_id(db, equipment_id)
    lab_id, dept_id = resolve_equipment_update_scope(existing, equipment_data)
    enforce_crud_access(effective, "equipment", "update", lab_id, dept_id)
    return await update_equipment(db, existing, equipment_data)


@router.delete(
    "/equipment/{equipment_id:int}/",
    status_code=204,
    summary="Удаление оборудования",
    description="Выполняет мягкое удаление оборудования.",
    responses={
        204: {"description": "Оборудование успешно удалено"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Оборудование не найдено"},
    },
)
# @IsAuthenticated
async def delete_equipment_endpoint(
    equipment_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> None:
    equipment = await require_equipment_by_id(db, equipment_id)
    enforce_crud_access(
        effective,
        "equipment",
        "delete",
        equipment.laboratory_id,
        equipment.department_id,
    )
    await delete_equipment(db, equipment)
