from __future__ import annotations
from fastapi import APIRouter, Form, Query
from core.deps import DbSession, ScopeSortIncludeDeletedFiltersDep, UserPermissions
from core.responses import build_attachment_response
from schemas.pagination import PaginatedResponse, build_paginated_response
from schemas.protocol import (
    ExcelStylesResponse,
    ProtocolTemplateCreate,
    ProtocolTemplateResponse,
    ProtocolTemplateUpdate,
    SaveExcelSectionResponse,
)
from services.access_control import enforce_crud_access, enforce_lab_management_access
from services.protocol.template import (
    create_protocol_template,
    get_protocol_templates,
    require_protocol_template_by_id,
    update_protocol_template,
)
from services.protocol.template_excel import (
    get_excel_styles,
    get_template_file,
    save_excel_section_from_form,
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
    responses={
        200: {"description": "Список шаблонов протоколов успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def list_protocol_templates(
    db: DbSession,
    effective: UserPermissions,
    filters: ScopeSortIncludeDeletedFiltersDep,
):
    enforce_crud_access(
        effective,
        "protocols",
        "read",
        filters.laboratory_id,
        filters.department_id,
    )
    items, total = await get_protocol_templates(
        db,
        laboratory_id=filters.laboratory_id,
        department_id=filters.department_id,
        include_deleted=filters.include_deleted,
        page=filters.page,
        page_size=filters.page_size,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
    )
    return build_paginated_response(items, total, filters.page, filters.page_size)


@router.get(
    "/protocol-templates/available/",
    response_model=list[ProtocolTemplateResponse],
    summary="Получение доступных шаблонов протоколов",
    description="Возвращает список доступных шаблонов протоколов для выбранной лаборатории и подразделения.",
    responses={
        200: {"description": "Список шаблонов протоколов успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def get_available_protocol_templates(
    db: DbSession,
    effective: UserPermissions,
    laboratory_id: int = Query(..., description="ID лаборатории"),
    department_id: int | None = Query(None, description="ID подразделения"),
):
    enforce_crud_access(effective, "protocols", "read", laboratory_id, department_id)
    items, _total = await get_protocol_templates(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        include_deleted=True,
    )
    return items


@router.post(
    "/protocol-templates/",
    response_model=ProtocolTemplateResponse,
    status_code=201,
    summary="Добавление шаблона протокола",
    description="Добавляет новый шаблон протокола на основе переданных данных.",
    responses={
        201: {"description": "Шаблон протокола успешно добавлен"},
        400: {"description": "Некорректные данные для добавления шаблона протокола"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def create_protocol_template_endpoint(
    template_data: ProtocolTemplateCreate,
    db: DbSession,
    effective: UserPermissions,
):
    enforce_lab_management_access(effective, template_data.laboratory_id, template_data.department_id)
    return await create_protocol_template(db, template_data)


@router.get(
    "/get-excel-styles/",
    response_model=ExcelStylesResponse,
    summary="Получение стилей для ячеек Excel файла",
    description="Возвращает стили ячеек в указанной секции Excel-файла шаблона протокола.",
    responses={
        200: {"description": "Стили успешно получены"},
        400: {"description": "В шаблоне нет меток шапки или некорректные данные"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Шаблон протокола не найден"},
    },
)
@router.get(
    "/protocol-templates/get-excel-styles/",
    response_model=ExcelStylesResponse,
    summary="Получение стилей для ячеек Excel файла",
    description="Возвращает стили ячеек в указанной секции Excel-файла шаблона протокола.",
    responses={
        200: {"description": "Стили успешно получены"},
        400: {"description": "В шаблоне нет меток шапки или некорректные данные"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Шаблон протокола не найден"},
    },
)
# @IsAuthenticated
async def get_excel_styles_endpoint(
    db: DbSession,
    effective: UserPermissions,
    template_id: int = Query(...),
    section: str = Query(..., description="Секция (зарезервировано; стили читаются из шапки)"),
) -> ExcelStylesResponse:
    _ = section
    template = await require_protocol_template_by_id(db, template_id)
    enforce_lab_management_access(effective, template.laboratory_id, template.department_id)
    return get_excel_styles(template)


@router.get(
    "/protocol-templates/{template_id:int}/",
    response_model=None,
    summary="Получение шаблона протокола по ID",
    description="Возвращает информацию о шаблоне протокола по его идентификатору или файл при download=true.",
    responses={
        200: {"description": "Шаблон протокола успешно получен"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Шаблон протокола не найден"},
    },
)
# @IsAuthenticated
async def get_protocol_template(
    template_id: int,
    db: DbSession,
    effective: UserPermissions,
    download: bool = Query(False, description="Скачать файл шаблона"),
    section: str | None = Query(
        None,
        description="Секция файла (зарезервировано; сейчас отдаётся весь шаблон)",
    ),
):
    _ = section
    template = await require_protocol_template_by_id(db, template_id)
    enforce_lab_management_access(effective, template.laboratory_id, template.department_id)
    if download:
        file_data, filename = get_template_file(template)
        return build_attachment_response(
            file_data,
            filename,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    return template


@router.patch(
    "/protocol-templates/{template_id:int}/",
    response_model=ProtocolTemplateResponse,
    summary="Обновление шаблона протокола",
    description="Обновляет существующий шаблон протокола.",
    responses={
        200: {"description": "Шаблон протокола успешно обновлен"},
        403: {"description": "Отказано в доступе"},
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
    template = await require_protocol_template_by_id(db, template_id)
    lab_id = template.laboratory_id
    dept_id = template.department_id
    enforce_lab_management_access(effective, lab_id, dept_id)
    return await update_protocol_template(db, template, template_data)


@router.post(
    "/save-excel/",
    response_model=SaveExcelSectionResponse,
    summary="Сохранение изменений в секции Excel файла",
    description="Сохраняет изменения в указанной секции Excel-файла шаблона протокола.",
    responses={
        200: {"description": "Изменения успешно сохранены"},
        400: {"description": "Ошибка при сохранении"},
        403: {"description": "Отказано в доступе"},
    },
)
@router.post(
    "/protocol-templates/save-excel/",
    response_model=SaveExcelSectionResponse,
    summary="Сохранение изменений в секции Excel файла",
    description="Сохраняет изменения в указанной секции Excel-файла шаблона протокола.",
    responses={
        200: {"description": "Изменения успешно сохранены"},
        400: {"description": "Ошибка при сохранении"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def save_excel_section_endpoint(
    db: DbSession,
    effective: UserPermissions,
    template_id: int = Form(...),
    section: str = Form(...),
    data: str = Form(...),
    styles: str = Form(...),
) -> SaveExcelSectionResponse:
    template = await require_protocol_template_by_id(db, template_id)
    enforce_lab_management_access(effective, template.laboratory_id, template.department_id)
    return await save_excel_section_from_form(db, template, data, styles, section)
