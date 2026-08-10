from __future__ import annotations
from fastapi import APIRouter, Depends
from core.deps import DbSession, ProtocolListFilters, UserPermissions
from core.responses import build_attachment_response
from schemas.pagination import PaginatedResponse
from schemas.protocol import (
    ProtocolCreate,
    ProtocolResponse,
    ProtocolUpdate,
)
from services.access_control import enforce_crud_access
from services.protocol import (
    build_protocols_list_response,
    create_protocol,
    delete_protocol,
    get_protocol_detail_response,
    get_protocol_response_data,
    get_protocols,
    require_protocol_by_id,
    update_protocol,
)
from services.protocol_generator import generate_protocol_excel

router = APIRouter()


@router.get(
    "/protocols/",
    response_model=PaginatedResponse[ProtocolResponse],
    summary="Получение списка протоколов",
    description=(
        "Возвращает список протоколов с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает фильтрацию по лабораториям и подразделениям, сортировку."
    ),
    responses={200: {"description": "Список протоколов успешно получен"}},
)
# @IsAuthenticated
async def list_protocols(
    db: DbSession,
    effective: UserPermissions,
    filters: ProtocolListFilters = Depends(),
):
    """Возвращает список протоколов с пагинацией или без."""
    enforce_crud_access(
        effective,
        "protocols",
        "read",
        filters.laboratory_id,
        filters.department_id,
    )
    protocols, total, total_pages = await get_protocols(
        db,
        laboratory_id=filters.laboratory_id,
        department_id=filters.department_id,
        include_deleted=filters.include_deleted,
        page=filters.page,
        page_size=filters.page_size,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
        is_accredited=filters.is_accredited,
        search=filters.search,
        search_date=filters.search_date,
        search_sampling_act=filters.search_sampling_act,
        search_samples=filters.search_samples,
        test_protocol_date_from=filters.test_protocol_date_from,
        test_protocol_date_to=filters.test_protocol_date_to,
        created_at_from=filters.created_at_from,
        created_at_to=filters.created_at_to,
    )

    items = await build_protocols_list_response(db, protocols)

    return PaginatedResponse(
        items=items,
        total=total,
        page=filters.page if filters.page is not None else 1,
        page_size=filters.page_size if filters.page_size is not None else total,
        total_pages=total_pages,
    )


@router.post(
    "/protocols/",
    response_model=ProtocolResponse,
    status_code=201,
    summary="Добавление нового протокола",
    description="Добавляет новый протокол на основе переданных данных.",
    responses={
        201: {"description": "Протокол успешно добавлен"},
        400: {"description": "Некорректные данные для добавления протокола"},
    },
)
# @IsAuthenticated
async def create_protocol_endpoint(
    protocol_data: ProtocolCreate,
    db: DbSession,
    effective: UserPermissions,
):
    """Добавляет новый протокол на основе переданных данных."""
    enforce_crud_access(
        effective,
        "protocols",
        "create",
        protocol_data.laboratory_id,
        protocol_data.department_id,
    )
    protocol = await create_protocol(db, protocol_data)
    return await get_protocol_response_data(db, protocol.id)


@router.get(
    "/protocols/{protocol_id}/",
    response_model=ProtocolResponse,
    summary="Получение протокола по ID",
    description="Возвращает информацию о протоколе по его идентификатору.",
    responses={
        200: {"description": "Протокол успешно получен"},
        404: {"description": "Протокол не найден"},
    },
)
# @IsAuthenticated
async def get_protocol(
    protocol_id: int,
    db: DbSession,
    effective: UserPermissions,
):
    """Возвращает информацию о протоколе по его идентификатору."""
    protocol = await require_protocol_by_id(db, protocol_id)
    enforce_crud_access(
        effective,
        "protocols",
        "read",
        protocol.laboratory_id,
        protocol.department_id,
    )
    return await get_protocol_detail_response(db, protocol_id)


@router.patch(
    "/protocols/{protocol_id}/",
    response_model=ProtocolResponse,
    summary="Обновление протокола",
    description="Обновляет существующий протокол.",
    responses={
        200: {"description": "Протокол успешно обновлен"},
        404: {"description": "Протокол не найден"},
    },
)
# @IsAuthenticated
async def update_protocol_endpoint(
    protocol_id: int,
    protocol_data: ProtocolUpdate,
    db: DbSession,
    effective: UserPermissions,
):
    """Обновляет существующий протокол."""
    protocol = await require_protocol_by_id(db, protocol_id)
    lab_id = protocol_data.laboratory_id or protocol.laboratory_id
    dept_id = protocol_data.department_id or protocol.department_id
    enforce_crud_access(effective, "protocols", "update", lab_id, dept_id)
    protocol = await update_protocol(db, protocol_id, protocol_data)
    return await get_protocol_response_data(db, protocol.id)


@router.delete(
    "/protocols/{protocol_id}/",
    status_code=204,
    summary="Удаление протокола",
    description="Выполняет мягкое удаление протокола.",
    responses={
        204: {"description": "Протокол успешно удален"},
        404: {"description": "Протокол не найден"},
    },
)
# @IsAuthenticated
async def delete_protocol_endpoint(
    protocol_id: int,
    db: DbSession,
    effective: UserPermissions,
):
    """Выполняет мягкое удаление протокола."""
    protocol = await require_protocol_by_id(db, protocol_id)
    enforce_crud_access(
        effective,
        "protocols",
        "delete",
        protocol.laboratory_id,
        protocol.department_id,
    )
    await delete_protocol(db, protocol_id)


@router.get(
    "/protocols/{protocol_id}/generate-excel/",
    summary="Генерация Excel файла протокола",
    description=(
        "Генерирует Excel-файл протокола на основе данных протокола и шаблона и возвращает его для скачивания."
    ),
    responses={
        200: {
            "description": "Excel файл успешно сгенерирован",
            "content": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {}},
        },
        404: {"description": "Протокол не найден"},
    },
)
# @IsAuthenticated
async def generate_protocol_excel_endpoint(
    protocol_id: int,
    db: DbSession,
    effective: UserPermissions,
):
    """Генерирует Excel-файл протокола на основе данных протокола и шаблона."""
    protocol = await require_protocol_by_id(db, protocol_id)
    enforce_crud_access(
        effective,
        "protocols",
        "read",
        protocol.laboratory_id,
        protocol.department_id,
    )
    content, filename = await generate_protocol_excel(db, protocol_id)
    return build_attachment_response(
        content,
        filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
