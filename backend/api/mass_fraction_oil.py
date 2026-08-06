from __future__ import annotations
from fastapi import APIRouter, Query
from core.auth_decorators import IsAuthenticated
from core.deps import DbSession, UserPermissions
from schemas.mass_fraction import (
    MassFractionOilRefractionTableBulkUpdate,
    MassFractionOilRefractionTableCreate,
    MassFractionOilRefractionTableResponse,
    MassFractionOilRefractionTableUpdate,
)
from schemas.pagination import PaginatedResponse
from services.access_control import enforce_crud_access
from services.mass_fraction import (
    bulk_update_mass_fraction_oil_refraction_tables,
    create_mass_fraction_oil_refraction_table,
    delete_mass_fraction_oil_refraction_table,
    get_mass_fraction_table_response_data,
    get_mass_fraction_tables_response_data,
    require_mass_fraction_oil_refraction_table_by_id,
    update_mass_fraction_oil_refraction_table,
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
    responses={200: {"description": "Градуировочный график успешно получен"}},
)
# @IsAuthenticated
async def list_mass_fraction_oil_refraction_tables(
    db: DbSession,
    effective: UserPermissions,
    research_method_id: int | None = Query(None),
    page: int | None = Query(None, ge=1),
    page_size: int | None = Query(None, ge=1, le=100),
    sort_by: str | None = Query(None),
    sort_order: str | None = Query("desc"),
):
    """Возвращает точки градуировочного графика с пагинацией или без."""
    if research_method_id is not None:
        method = await require_research_method_by_id(db, research_method_id)
        enforce_crud_access(
            effective,
            "refraction_tables",
            "read",
            method.laboratory_id,
            method.department_id,
        )
    else:
        enforce_crud_access(effective, "refraction_tables", "read")
    items, total, total_pages = await get_mass_fraction_tables_response_data(
        db,
        research_method_id=research_method_id,
        page=page,
        page_size=page_size,
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


@router.post(
    "/mass-fraction-oil-refraction-tables/",
    response_model=MassFractionOilRefractionTableResponse,
    status_code=201,
    summary="Добавление точки градуировочного графика",
    description="Добавляет новую точку градуировочного графика (пара C–n).",
    responses={
        201: {"description": "Точка градуировочного графика успешно добавлена"},
        400: {
            "description": "Некорректные данные для добавления точки градуировочного графика"
        },
    },
)
# @IsAuthenticated
async def create_mass_fraction_oil_refraction_table_endpoint(
    table_data: MassFractionOilRefractionTableCreate,
    db: DbSession,
    effective: UserPermissions,
):
    """Добавляет новую точку градуировочного графика."""
    method = await require_research_method_by_id(db, table_data.research_method_id)
    enforce_crud_access(
        effective,
        "refraction_tables",
        "create",
        method.laboratory_id,
        method.department_id,
    )
    table = await create_mass_fraction_oil_refraction_table(db, table_data)
    return await get_mass_fraction_table_response_data(db, table.id)


@router.patch(
    "/mass-fraction-oil-refraction-tables/{table_id}/",
    response_model=MassFractionOilRefractionTableResponse,
    summary="Обновление точки градуировочного графика",
    description="Обновляет существующую точку градуировочного графика.",
    responses={
        200: {"description": "Точка градуировочного графика успешно обновлена"},
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
    """Обновляет существующую точку градуировочного графика."""
    table = await require_mass_fraction_oil_refraction_table_by_id(db, table_id)
    method = await require_research_method_by_id(db, table.research_method_id)
    enforce_crud_access(
        effective,
        "refraction_tables",
        "update",
        method.laboratory_id,
        method.department_id,
    )
    await update_mass_fraction_oil_refraction_table(db, table_id, table_data)
    return await get_mass_fraction_table_response_data(db, table_id)


@router.delete(
    "/mass-fraction-oil-refraction-tables/{table_id}/",
    status_code=204,
    summary="Удаление точки градуировочного графика",
    description="Выполняет мягкое удаление точки градуировочного графика.",
    responses={
        204: {"description": "Точка градуировочного графика успешно удалена"},
        404: {"description": "Точка градуировочного графика не найдена"},
    },
)
# @IsAuthenticated
async def delete_mass_fraction_oil_refraction_table_endpoint(
    table_id: int,
    db: DbSession,
    effective: UserPermissions,
):
    """Выполняет мягкое удаление точки градуировочного графика."""
    table = await require_mass_fraction_oil_refraction_table_by_id(db, table_id)
    method = await require_research_method_by_id(db, table.research_method_id)
    enforce_crud_access(
        effective,
        "refraction_tables",
        "delete",
        method.laboratory_id,
        method.department_id,
    )
    await delete_mass_fraction_oil_refraction_table(db, table_id)


@router.post(
    "/mass-fraction-oil-refraction-tables/bulk-update/",
    response_model=dict,
    status_code=200,
    summary="Массовое обновление градуировочного графика",
    description=(
        "Выполняет массовое обновление градуировочного графика. "
        "Помечает старые точки как неактивные и создаёт новые."
    ),
    responses={
        200: {"description": "Градуировочный график успешно обновлен"},
        400: {"description": "Некорректные данные для обновления"},
    },
)
# @IsAuthenticated
async def bulk_update_mass_fraction_oil_refraction_tables_endpoint(
    bulk_data: MassFractionOilRefractionTableBulkUpdate,
    db: DbSession,
    effective: UserPermissions,
):
    """Выполняет массовое обновление градуировочного графика."""
    method = await require_research_method_by_id(db, bulk_data.research_method_id)
    enforce_crud_access(
        effective,
        "refraction_tables",
        "update",
        method.laboratory_id,
        method.department_id,
    )
    return await bulk_update_mass_fraction_oil_refraction_tables(db, bulk_data)
