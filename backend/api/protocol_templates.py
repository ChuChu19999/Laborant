from __future__ import annotations
from fastapi import APIRouter, Depends, Form, Query
import orjson
from core.deps import DbSession, ScopeSortPaginationParams, UserPermissions
from core.exceptions import ValidationError
from core.logger import logger
from core.responses import build_attachment_response
from schemas.pagination import PaginatedResponse
from schemas.protocol import (
    ProtocolTemplateCreate,
    ProtocolTemplateResponse,
    ProtocolTemplateUpdate,
)
from services.access_control import enforce_crud_access, enforce_lab_management_access
from services.excel_template import (
    get_excel_styles,
    get_template_file,
    save_excel_section,
)
from services.protocol import (
    build_protocol_template_response,
    create_protocol_template,
    get_protocol_template_response_data,
    get_protocol_templates,
    require_protocol_template_by_id,
    update_protocol_template,
)

router = APIRouter()


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
    effective: UserPermissions,
    params: ScopeSortPaginationParams = Depends(),
    include_deleted: bool = Query(False),
):
    """Возвращает список шаблонов протоколов с пагинацией или без."""
    enforce_lab_management_access(effective, params.laboratory_id, params.department_id)
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
    description=("Возвращает список доступных шаблонов протоколов для указанной лаборатории и подразделения."),
    responses={200: {"description": "Список доступных шаблонов успешно получен"}},
)
# @IsAuthenticated
async def get_available_protocol_templates(
    db: DbSession,
    effective: UserPermissions,
    laboratory_id: int = Query(..., description="ID лаборатории"),
    department_id: int | None = Query(None, description="ID подразделения"),
):
    """Возвращает список доступных шаблонов протоколов для указанной лаборатории и подразделения."""
    enforce_crud_access(effective, "protocols", "read", laboratory_id, department_id)
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
    effective: UserPermissions,
):
    """Добавляет новый шаблон протокола на основе переданных данных."""
    enforce_lab_management_access(effective, template_data.laboratory_id, template_data.department_id)
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
    effective: UserPermissions,
    download: bool = Query(False, description="Скачать файл шаблона"),
    section: str | None = Query(None, description="Секция для скачивания"),
):
    """Возвращает информацию о шаблоне протокола по его идентификатору или файл при download=true."""
    template = await require_protocol_template_by_id(db, template_id)
    enforce_lab_management_access(effective, template.laboratory_id, template.department_id)
    if download:
        file_data = await get_template_file(template, section)
        return build_attachment_response(
            file_data,
            template.file_name,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
    effective: UserPermissions,
):
    """Обновляет существующий шаблон протокола."""
    template = await require_protocol_template_by_id(db, template_id)
    lab_id = template.laboratory_id
    dept_id = template.department_id
    enforce_lab_management_access(effective, lab_id, dept_id)
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
    effective: UserPermissions,
    data: str = Form(...),
    styles: str = Form(...),
    template_id: int = Form(...),
    section: str = Form(...),
):
    """Сохраняет изменения в указанной секции Excel-файла шаблона протокола."""
    template = await require_protocol_template_by_id(db, template_id)
    enforce_lab_management_access(effective, template.laboratory_id, template.department_id)
    try:
        data_list = orjson.loads(data)
        styles_dict = orjson.loads(styles)

        result = await save_excel_section(db, template_id, data_list, styles_dict, section)
        return result
    except Exception as e:
        logger.error(f"Ошибка при сохранении Excel файла: {e!s}", exc_info=True)
        raise ValidationError(f"Ошибка при сохранении: {e!s}")


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
    effective: UserPermissions,
    template_id: int = Query(...),
    section: str = Query(...),
):
    """Возвращает стили ячеек в указанной секции Excel-файла шаблона протокола."""
    template = await require_protocol_template_by_id(db, template_id)
    enforce_lab_management_access(effective, template.laboratory_id, template.department_id)
    return await get_excel_styles(db, template_id, section)
