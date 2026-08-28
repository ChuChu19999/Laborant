from __future__ import annotations
from fastapi import APIRouter
from core.deps import DbSession, MassFractionListFiltersDep, UserPermissions
from schemas.mass_fraction import (
    MassFractionOilRefractionTableBulkUpdate,
    MassFractionOilRefractionTableBulkUpdateResponse,
    MassFractionOilRefractionTableCreate,
    MassFractionOilRefractionTableResponse,
    MassFractionOilRefractionTableUpdate,
)
from schemas.pagination import PaginatedResponse, build_paginated_response
from services.access_control import enforce_crud_access
from services.mass_fraction import (
    bulk_update_mass_fraction_oil_refraction_tables,
    create_with_access,
    delete_with_access,
    list_with_access,
    update_with_access,
)
from services.research import require_research_method_by_id

router = APIRouter()


@router.get(
    "/mass-fraction-oil-refraction-tables/",
    response_model=PaginatedResponse[MassFractionOilRefractionTableResponse],
    summary="Получение градуировочного графика",
    description=(
        "Возвращает точки градуировочного графика (массовая доля нефти C и показатель преломления n) "
        "с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает фильтрацию по методам исследования, сортировку."
    ),
    responses={
        200: {"description": "Градуировочный график успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def list_mass_fraction_oil_refraction_tables(
    db: DbSession,
    effective: UserPermissions,
    filters: MassFractionListFiltersDep,
):
    items, total = await list_with_access(
        db,
        effective,
        research_method_id=filters.research_method_id,
        page=filters.page,
        page_size=filters.page_size,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
    )
    return build_paginated_response(items, total, filters.page, filters.page_size)


@router.post(
    "/mass-fraction-oil-refraction-tables/",
    response_model=MassFractionOilRefractionTableResponse,
    status_code=201,
    summary="Добавление точки градуировочного графика",
    description="Добавляет новую точку градуировочного графика (пара C–n).",
    responses={
        201: {"description": "Точка градуировочного графика успешно добавлена"},
        400: {"description": "Некорректные данные для добавления точки градуировочного графика"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def create_mass_fraction_oil_refraction_table_endpoint(
    table_data: MassFractionOilRefractionTableCreate,
    db: DbSession,
    effective: UserPermissions,
):
    return await create_with_access(db, effective, table_data)


@router.patch(
    "/mass-fraction-oil-refraction-tables/{table_id:int}/",
    response_model=MassFractionOilRefractionTableResponse,
    summary="Обновление точки градуировочного графика",
    description="Обновляет существующую точку градуировочного графика.",
    responses={
        200: {"description": "Точка градуировочного графика успешно обновлена"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Точка градуировочного графика не найдена"},
    },
)
# @IsAuthenticated
async def update_mass_fraction_oil_refraction_table_endpoint(
    table_id: int,
    table_data: MassFractionOilRefractionTableUpdate,
    db: DbSession,
    effective: UserPermissions,
):
    return await update_with_access(db, effective, table_id, table_data)


@router.delete(
    "/mass-fraction-oil-refraction-tables/{table_id:int}/",
    status_code=204,
    summary="Удаление точки градуировочного графика",
    description="Выполняет мягкое удаление точки градуировочного графика.",
    responses={
        204: {"description": "Точка градуировочного графика успешно удалена"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Точка градуировочного графика не найдена"},
    },
)
# @IsAuthenticated
async def delete_mass_fraction_oil_refraction_table_endpoint(
    table_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> None:
    await delete_with_access(db, effective, table_id)


@router.post(
    "/mass-fraction-oil-refraction-tables/bulk-update/",
    response_model=MassFractionOilRefractionTableBulkUpdateResponse,
    status_code=200,
    summary="Массовое обновление градуировочного графика",
    description=(
        "Выполняет массовое обновление градуировочного графика. Помечает старые точки как неактивные и создаёт новые."
    ),
    responses={
        200: {"description": "Градуировочный график успешно обновлен"},
        400: {"description": "Некорректные данные для обновления"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def bulk_update_mass_fraction_oil_refraction_tables_endpoint(
    bulk_data: MassFractionOilRefractionTableBulkUpdate,
    db: DbSession,
    effective: UserPermissions,
) -> MassFractionOilRefractionTableBulkUpdateResponse:
    method = await require_research_method_by_id(db, bulk_data.research_method_id)
    enforce_crud_access(
        effective,
        "refraction_tables",
        "update",
        method.laboratory_id,
        method.department_id,
    )
    return await bulk_update_mass_fraction_oil_refraction_tables(db, bulk_data)
