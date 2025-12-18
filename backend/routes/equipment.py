from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.exceptions import NotFoundError
from core.security import IsAuthenticated
from schemas.equipment import EquipmentCreate, EquipmentResponse, EquipmentUpdate
from schemas.pagination import PaginatedResponse
from services.equipment import (
    create_equipment,
    delete_equipment,
    get_equipment_by_id,
    get_equipment_list,
    update_equipment,
)
from utils.query_params import parse_date_range_params

router = APIRouter()


@router.get(
    "/equipment/",
    response_model=PaginatedResponse[EquipmentResponse],
    summary="Получение списка оборудования",
    description=(
        "Возвращает список оборудования с пагинацией. "
        "Поддерживает фильтрацию по лабораториям, подразделениям и типу оборудования, поиск и сортировку."
    ),
    responses={200: {"description": "Список оборудования успешно получен"}},
)
# @IsAuthenticated
async def list_equipment(
    laboratory_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    equipment_type: Optional[str] = Query(None),
    equipment_types: Optional[list[str]] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
    verification_date_from: Optional[str] = Query(None),
    verification_date_to: Optional[str] = Query(None),
    verification_end_date_from: Optional[str] = Query(None),
    verification_end_date_to: Optional[str] = Query(None),
    created_at_from: Optional[str] = Query(None),
    created_at_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Получить список оборудования с пагинацией.
    """
    verification_date_from_parsed, verification_date_to_parsed = (
        parse_date_range_params(verification_date_from, verification_date_to)
    )
    verification_end_date_from_parsed, verification_end_date_to_parsed = (
        parse_date_range_params(verification_end_date_from, verification_end_date_to)
    )
    created_at_from_parsed, created_at_to_parsed = parse_date_range_params(
        created_at_from, created_at_to
    )

    equipment_types_list = (
        equipment_types
        if equipment_types
        else ([equipment_type] if equipment_type else None)
    )

    equipment_list, total, total_pages = await get_equipment_list(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        equipment_types=equipment_types_list,
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        verification_date_from=verification_date_from_parsed,
        verification_date_to=verification_date_to_parsed,
        verification_end_date_from=verification_end_date_from_parsed,
        verification_end_date_to=verification_end_date_to_parsed,
        created_at_from=created_at_from_parsed,
        created_at_to=created_at_to_parsed,
    )

    items = []
    for eq in equipment_list:
        eq_dict = EquipmentResponse.model_validate(eq).model_dump()
        if hasattr(eq, "laboratory") and eq.laboratory:
            eq_dict["laboratory_name"] = eq.laboratory.name
        if hasattr(eq, "department") and eq.department:
            eq_dict["department_name"] = eq.department.name
        items.append(EquipmentResponse(**eq_dict))

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "/equipment/",
    response_model=EquipmentResponse,
    status_code=201,
    summary="Создание нового оборудования",
    description="Создает новое оборудование на основе переданных данных.",
    responses={
        201: {"description": "Оборудование успешно создано"},
        400: {"description": "Некорректные данные для создания оборудования"},
    },
)
# @IsAuthenticated
async def create_equipment_endpoint(
    equipment_data: EquipmentCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Создать оборудование.

    Создает новое оборудование на основе переданных данных.
    """
    equipment = await create_equipment(db, equipment_data)

    eq_dict = EquipmentResponse.model_validate(equipment).model_dump()
    if hasattr(equipment, "laboratory") and equipment.laboratory:
        eq_dict["laboratory_name"] = equipment.laboratory.name
    if hasattr(equipment, "department") and equipment.department:
        eq_dict["department_name"] = equipment.department.name

    await db.commit()
    return EquipmentResponse(**eq_dict)


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
async def get_equipment(
    equipment_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Получить оборудование по ID.
    """
    equipment = await get_equipment_by_id(db, equipment_id)
    if not equipment:
        raise NotFoundError("Оборудование не найдено")
    eq_dict = EquipmentResponse.model_validate(equipment).model_dump()
    if hasattr(equipment, "laboratory") and equipment.laboratory:
        eq_dict["laboratory_name"] = equipment.laboratory.name
    if hasattr(equipment, "department") and equipment.department:
        eq_dict["department_name"] = equipment.department.name
    return EquipmentResponse(**eq_dict)


@router.patch(
    "/equipment/{equipment_id}/",
    response_model=EquipmentResponse,
    summary="Обновление оборудования",
    description="Обновляет существующее оборудование. Можно обновить только указанные поля.",
    responses={
        200: {"description": "Оборудование успешно обновлено"},
        404: {"description": "Оборудование не найдено"},
    },
)
# @IsAuthenticated
async def update_equipment_endpoint(
    equipment_id: int,
    equipment_data: EquipmentUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Обновить оборудование.

    Обновляет существующее оборудование по его идентификатору.
    """
    equipment = await update_equipment(db, equipment_id, equipment_data)

    eq_dict = EquipmentResponse.model_validate(equipment).model_dump()
    if hasattr(equipment, "laboratory") and equipment.laboratory:
        eq_dict["laboratory_name"] = equipment.laboratory.name
    if hasattr(equipment, "department") and equipment.department:
        eq_dict["department_name"] = equipment.department.name

    await db.commit()
    return EquipmentResponse(**eq_dict)


@router.delete(
    "/equipment/{equipment_id}/",
    status_code=204,
    summary="Удаление оборудования",
    description="Выполняет мягкое удаление оборудования. Оборудование помечается как удаленное.",
    responses={
        204: {"description": "Оборудование успешно удалено"},
        404: {"description": "Оборудование не найдено"},
    },
)
# @IsAuthenticated
async def delete_equipment_endpoint(
    equipment_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Удалить оборудование (мягкое удаление).

    Выполняет мягкое удаление оборудования по его идентификатору.
    """
    await delete_equipment(db, equipment_id)
    await db.commit()
