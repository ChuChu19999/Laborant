from __future__ import annotations
from fastapi import APIRouter, Depends
from core.auth_decorators import IsAuthenticated
from core.deps import DbSession, EquipmentListFilters
from core.exceptions import NotFoundError
from schemas.equipment import EquipmentCreate, EquipmentResponse, EquipmentUpdate
from schemas.pagination import PaginatedResponse
from services.equipment import (
    build_equipment_response,
    create_equipment,
    delete_equipment,
)
from services.equipment import get_equipment as get_equipment_list
from services.equipment import (
    get_equipment_by_id,
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
    responses={200: {"description": "Список оборудования успешно получен"}},
)
# @IsAuthenticated
async def list_equipment(
    db: DbSession,
    filters: EquipmentListFilters = Depends(),
):
    """Возвращает список оборудования с пагинацией или без."""
    equipment_list, total, total_pages = await get_equipment_list(
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

    items = [build_equipment_response(eq) for eq in equipment_list]

    return PaginatedResponse(
        items=items,
        total=total,
        page=filters.page if filters.page is not None else 1,
        page_size=filters.page_size if filters.page_size is not None else total,
        total_pages=total_pages,
    )


@router.post(
    "/equipment/",
    response_model=EquipmentResponse,
    status_code=201,
    summary="Добавление нового оборудования",
    description="Добавляет новое оборудование на основе переданных данных.",
    responses={
        201: {"description": "Оборудование успешно добавлено"},
        400: {"description": "Некорректные данные для добавления оборудования"},
    },
)
# @IsAuthenticated
async def create_equipment_endpoint(
    equipment_data: EquipmentCreate,
    db: DbSession,
):
    """Добавляет новое оборудование на основе переданных данных."""
    equipment = await create_equipment(db, equipment_data)
    return build_equipment_response(equipment)


@router.get(
    "/equipment/{equipment_id}/",
    response_model=EquipmentResponse,
    summary="Получение оборудования по ID",
    description="Возвращает информацию об оборудовании по его идентификатору.",
    responses={
        200: {"description": "Оборудование успешно получено"},
        404: {"description": "Оборудование не найдено"},
    },
)
# @IsAuthenticated
async def get_equipment_endpoint(
    equipment_id: int,
    db: DbSession,
):
    """Возвращает информацию об оборудовании по его идентификатору."""
    equipment = await get_equipment_by_id(db, equipment_id)
    if not equipment:
        raise NotFoundError("Оборудование не найдено")
    return build_equipment_response(equipment)


@router.patch(
    "/equipment/{equipment_id}/",
    response_model=EquipmentResponse,
    summary="Обновление оборудования",
    description="Обновляет существующее оборудование.",
    responses={
        200: {"description": "Оборудование успешно обновлено"},
        404: {"description": "Оборудование не найдено"},
    },
)
# @IsAuthenticated
async def update_equipment_endpoint(
    equipment_id: int,
    equipment_data: EquipmentUpdate,
    db: DbSession,
):
    """Обновляет существующее оборудование."""
    equipment = await update_equipment(db, equipment_id, equipment_data)
    return build_equipment_response(equipment)


@router.delete(
    "/equipment/{equipment_id}/",
    status_code=204,
    summary="Удаление оборудования",
    description="Выполняет мягкое удаление оборудования.",
    responses={
        204: {"description": "Оборудование успешно удалено"},
        404: {"description": "Оборудование не найдено"},
    },
)
# @IsAuthenticated
async def delete_equipment_endpoint(
    equipment_id: int,
    db: DbSession,
):
    """Выполняет мягкое удаление оборудования."""
    await delete_equipment(db, equipment_id)
