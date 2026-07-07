from __future__ import annotations
from typing import Optional
from urllib.parse import quote
import orjson
from fastapi import APIRouter, Depends, Form, Query
from fastapi.responses import Response
from core.auth_decorators import IsAuthenticated
from core.deps import DbSession, ProtocolListFilters, ScopeSortPaginationParams
from core.exceptions import NotFoundError, ValidationError
from core.logger import logger
from schemas.pagination import PaginatedResponse
from schemas.protocol import (
    ProtocolCreate,
    ProtocolResponse,
    ProtocolTemplateCreate,
    ProtocolTemplateResponse,
    ProtocolTemplateUpdate,
    ProtocolUpdate,
)
from services.excel_template import (
    get_excel_styles,
    get_template_file,
    save_excel_section,
)
from services.protocol import (
    build_protocol_template_response,
    build_protocols_list_response,
    create_protocol,
    create_protocol_template,
    delete_protocol,
    get_protocol_detail_response,
    get_protocol_response_data,
    get_protocol_template_by_id,
    get_protocol_template_response_data,
    get_protocol_templates,
    get_protocols,
    update_protocol,
    update_protocol_template,
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
    filters: ProtocolListFilters = Depends(),
):
    """Возвращает список протоколов с пагинацией или без."""
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
):
    """Добавляет новый протокол на основе переданных данных."""
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
):
    """Возвращает информацию о протоколе по его идентификатору."""
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
):
    """Обновляет существующий протокол."""
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
):
    """Выполняет мягкое удаление протокола."""
    await delete_protocol(db, protocol_id)


@router.get(
    "/protocols/{protocol_id}/generate-excel/",
    response_class=Response,
    summary="Генерация Excel файла протокола",
    description=(
        "Генерирует Excel-файл протокола на основе данных протокола и шаблона "
        "и возвращает его для скачивания."
    ),
    responses={
        200: {
            "description": "Excel файл успешно сгенерирован",
            "content": {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {}
            },
        },
        404: {"description": "Протокол не найден"},
    },
)
# @IsAuthenticated
async def generate_protocol_excel_endpoint(
    protocol_id: int,
    db: DbSession,
):
    """Генерирует Excel-файл протокола на основе данных протокола и шаблона."""
    return await generate_protocol_excel(db, protocol_id)


@router.get(
    "/protocol-templates/",
    response_model=PaginatedResponse[ProtocolTemplateResponse],
    summary="Получение списка шаблонов протоколов",
    description=(
        "Возвращает список шаблонов протоколов с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает фильтрацию по лабораториям и подразделениям, сортировку."
    ),
    responses={200: {"description": "Список шаблонов протоколов успешно получен"}},
)
# @IsAuthenticated
async def list_protocol_templates(
    db: DbSession,
    params: ScopeSortPaginationParams = Depends(),
    include_deleted: bool = Query(False),
):
    """Возвращает список шаблонов протоколов с пагинацией или без."""
    templates, total, total_pages = await get_protocol_templates(
        db,
        laboratory_id=params.laboratory_id,
        department_id=params.department_id,
        include_deleted=include_deleted,
        page=params.page,
        page_size=params.page_size,
        sort_by=params.sort_by,
        sort_order=params.sort_order,
    )

    items = [build_protocol_template_response(template) for template in templates]

    return PaginatedResponse(
        items=items,
        total=total,
        page=params.page if params.page is not None else 1,
        page_size=params.page_size if params.page_size is not None else total,
        total_pages=total_pages,
    )


@router.get(
    "/protocol-templates/available/",
    response_model=list[ProtocolTemplateResponse],
    summary="Получение доступных шаблонов протоколов",
    description=(
        "Возвращает список доступных шаблонов протоколов для указанной лаборатории и подразделения."
    ),
    responses={200: {"description": "Список доступных шаблонов успешно получен"}},
)
# @IsAuthenticated
async def get_available_protocol_templates(
    db: DbSession,
    laboratory_id: int = Query(..., description="ID лаборатории"),
    department_id: Optional[int] = Query(None, description="ID подразделения"),
):
    """Возвращает список доступных шаблонов протоколов для указанной лаборатории и подразделения."""
    templates, _, _ = await get_protocol_templates(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        include_deleted=True,
    )

    items = [build_protocol_template_response(template) for template in templates]

    return items


@router.post(
    "/protocol-templates/",
    response_model=ProtocolTemplateResponse,
    status_code=201,
    summary="Добавление нового шаблона протокола",
    description="Добавляет новый шаблон протокола на основе переданных данных.",
    responses={
        201: {"description": "Шаблон протокола успешно добавлен"},
        400: {"description": "Некорректные данные для добавления шаблона протокола"},
    },
)
# @IsAuthenticated
async def create_protocol_template_endpoint(
    template_data: ProtocolTemplateCreate,
    db: DbSession,
):
    """Добавляет новый шаблон протокола на основе переданных данных."""
    template = await create_protocol_template(db, template_data)
    return await get_protocol_template_response_data(db, template.id)


@router.get(
    "/protocol-templates/{template_id}/",
    summary="Получение шаблона протокола по ID",
    description="Возвращает информацию о шаблоне протокола по его идентификатору или файл при download=true.",
    responses={
        200: {"description": "Шаблон протокола успешно получен"},
        404: {"description": "Шаблон протокола не найден"},
    },
)
# @IsAuthenticated
async def get_protocol_template(
    template_id: int,
    db: DbSession,
    download: bool = Query(False, description="Скачать файл шаблона"),
    section: Optional[str] = Query(None, description="Секция для скачивания"),
):
    """Возвращает информацию о шаблоне протокола по его идентификатору или файл при download=true."""
    template = await get_protocol_template_by_id(db, template_id)
    if not template:
        raise NotFoundError("Шаблон протокола не найден")

    if download:
        file_data = await get_template_file(template, section)
        # Правильное кодирование имени файла для поддержки не-ASCII символов (RFC 2231)
        encoded_filename = quote(template.file_name, safe="")
        # Используем только filename* для избежания проблем с latin-1 кодированием в Starlette
        content_disposition = f"attachment; filename*=UTF-8''{encoded_filename}"
        return Response(
            content=file_data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": content_disposition},
        )

    return build_protocol_template_response(template)


@router.patch(
    "/protocol-templates/{template_id}/",
    response_model=ProtocolTemplateResponse,
    summary="Обновление шаблона протокола",
    description="Обновляет существующий шаблон протокола.",
    responses={
        200: {"description": "Шаблон протокола успешно обновлен"},
        404: {"description": "Шаблон протокола не найден"},
    },
)
# @IsAuthenticated
async def update_protocol_template_endpoint(
    template_id: int,
    template_data: ProtocolTemplateUpdate,
    db: DbSession,
):
    """Обновляет существующий шаблон протокола."""
    template = await update_protocol_template(db, template_id, template_data)
    return await get_protocol_template_response_data(db, template.id)


@router.post(
    "/save-excel/",
    summary="Сохранение изменений в секции Excel файла",
    description="Сохраняет изменения в указанной секции Excel-файла шаблона протокола.",
    responses={
        200: {"description": "Изменения успешно сохранены"},
        400: {"description": "Ошибка при сохранении"},
    },
)
# @IsAuthenticated
async def save_excel_endpoint(
    db: DbSession,
    data: str = Form(...),
    styles: str = Form(...),
    template_id: int = Form(...),
    section: str = Form(...),
):
    """Сохраняет изменения в указанной секции Excel-файла шаблона протокола."""
    try:
        data_list = orjson.loads(data)
        styles_dict = orjson.loads(styles)

        result = await save_excel_section(
            db, template_id, data_list, styles_dict, section
        )
        return result
    except Exception as e:
        logger.error(f"Ошибка при сохранении Excel файла: {str(e)}", exc_info=True)
        raise ValidationError(f"Ошибка при сохранении: {str(e)}")


@router.get(
    "/get-excel-styles/",
    summary="Получение стилей для ячеек Excel файла",
    description="Возвращает стили ячеек в указанной секции Excel-файла шаблона протокола.",
    responses={
        200: {"description": "Стили успешно получены"},
        404: {"description": "Шаблон протокола не найден"},
    },
)
# @IsAuthenticated
async def get_excel_styles_endpoint(
    db: DbSession,
    template_id: int = Query(...),
    section: str = Query(...),
):
    """Возвращает стили ячеек в указанной секции Excel-файла шаблона протокола."""
    return await get_excel_styles(db, template_id, section)
