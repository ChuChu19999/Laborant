from __future__ import annotations
from fastapi import APIRouter
from starlette.responses import Response
from core.deps import DbSession, ProtocolListFiltersDep, UserPermissions
from core.responses import build_attachment_response
from schemas.pagination import PaginatedResponse, build_paginated_response
from schemas.protocol import (
    ProtocolCreate,
    ProtocolResponse,
    ProtocolUpdate,
)
from services.access_control import enforce_crud_access
from services.protocol.generator import generate_protocol_excel
from services.protocol.service import (
    create_protocol_for_response,
    delete_protocol,
    get_protocol_for_response,
    get_protocols,
    require_protocol_by_id,
    resolve_protocol_update_scope,
    update_protocol_for_response,
)

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
    responses={
        200: {"description": "Список протоколов успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def list_protocols(
    db: DbSession,
    effective: UserPermissions,
    filters: ProtocolListFiltersDep,
):
    enforce_crud_access(
        effective,
        "protocols",
        "read",
        filters.laboratory_id,
        filters.department_id,
    )
    protocols, total = await get_protocols(
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
    return build_paginated_response(protocols, total, filters.page, filters.page_size)


@router.post(
    "/protocols/",
    response_model=ProtocolResponse,
    status_code=201,
    summary="Добавление нового протокола",
    description="Добавляет новый протокол на основе переданных данных.",
    responses={
        201: {"description": "Протокол успешно добавлен"},
        400: {"description": "Некорректные данные для добавления протокола"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def create_protocol_endpoint(
    protocol_data: ProtocolCreate,
    db: DbSession,
    effective: UserPermissions,
) -> ProtocolResponse:
    enforce_crud_access(
        effective,
        "protocols",
        "create",
        protocol_data.laboratory_id,
        protocol_data.department_id,
    )
    return await create_protocol_for_response(db, protocol_data)


@router.get(
    "/protocols/{protocol_id:int}/",
    response_model=ProtocolResponse,
    summary="Получение протокола по ID",
    description="Возвращает информацию о протоколе по его идентификатору.",
    responses={
        200: {"description": "Протокол успешно получен"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Протокол не найден"},
    },
)
# @IsAuthenticated
async def get_protocol(
    protocol_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> ProtocolResponse:
    response = await get_protocol_for_response(db, protocol_id)
    enforce_crud_access(
        effective,
        "protocols",
        "read",
        response.laboratory_id,
        response.department_id,
    )
    return response


@router.patch(
    "/protocols/{protocol_id:int}/",
    response_model=ProtocolResponse,
    summary="Обновление протокола",
    description="Обновляет существующий протокол.",
    responses={
        200: {"description": "Протокол успешно обновлен"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Протокол не найден"},
    },
)
# @IsAuthenticated
async def update_protocol_endpoint(
    protocol_id: int,
    protocol_data: ProtocolUpdate,
    db: DbSession,
    effective: UserPermissions,
) -> ProtocolResponse:
    protocol = await require_protocol_by_id(db, protocol_id)
    lab_id, dept_id = resolve_protocol_update_scope(protocol, protocol_data)
    enforce_crud_access(effective, "protocols", "update", lab_id, dept_id)
    return await update_protocol_for_response(db, protocol_id, protocol_data, protocol=protocol)


@router.delete(
    "/protocols/{protocol_id:int}/",
    status_code=204,
    summary="Удаление протокола",
    description="Выполняет мягкое удаление протокола.",
    responses={
        204: {"description": "Протокол успешно удалён"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Протокол не найден"},
    },
)
# @IsAuthenticated
async def delete_protocol_endpoint(
    protocol_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> None:
    protocol = await require_protocol_by_id(db, protocol_id)
    enforce_crud_access(
        effective,
        "protocols",
        "delete",
        protocol.laboratory_id,
        protocol.department_id,
    )
    await delete_protocol(db, protocol)


@router.get(
    "/protocols/{protocol_id:int}/generate-excel/",
    summary="Генерация Excel файла протокола",
    description=(
        "Генерирует Excel-файл протокола на основе данных протокола и шаблона и возвращает его для скачивания."
    ),
    responses={
        200: {
            "description": "Excel файл успешно сгенерирован",
            "content": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {}},
        },
        403: {"description": "Отказано в доступе"},
        404: {"description": "Протокол не найден"},
    },
)
# @IsAuthenticated
async def generate_protocol_excel_endpoint(
    protocol_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> Response:
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
