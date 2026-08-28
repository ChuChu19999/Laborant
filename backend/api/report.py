from __future__ import annotations
from fastapi import APIRouter, Query
from core.deps import DbSession, ScopeSortIncludeDeletedFiltersDep, UserPermissions
from core.responses import build_attachment_response
from schemas.pagination import PaginatedResponse, build_paginated_response
from schemas.report import (
    GenerateKgsReportRequest,
    GenerateNksReportRequest,
    GeneratePhysicochemicalReportRequest,
    GenerateSampleCountReportRequest,
    ReportTemplateCreate,
    ReportTemplateResponse,
    ReportTemplateUpdate,
)
from services.access_control import enforce_lab_management_access, enforce_nav_access
from services.report import (
    create_report_template,
    generate_kgs_report_file,
    generate_nks_report_file,
    generate_physicochemical_report_file,
    generate_sample_count_report_file,
    get_report_template_download,
    get_report_templates,
    require_report_template_by_id,
    update_report_template,
)

router = APIRouter()


@router.get(
    "/report-templates/",
    response_model=PaginatedResponse[ReportTemplateResponse],
    summary="Получение списка шаблонов отчётов",
    description=(
        "Возвращает список шаблонов отчётов с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает фильтрацию по лабораториям и подразделениям, сортировку."
    ),
    responses={
        200: {"description": "Список шаблонов отчётов успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def list_report_templates(
    db: DbSession,
    effective: UserPermissions,
    filters: ScopeSortIncludeDeletedFiltersDep,
):
    enforce_lab_management_access(effective, filters.laboratory_id, filters.department_id)
    templates, total = await get_report_templates(
        db,
        laboratory_id=filters.laboratory_id,
        department_id=filters.department_id,
        include_deleted=filters.include_deleted,
        page=filters.page,
        page_size=filters.page_size,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
    )
    return build_paginated_response(templates, total, filters.page, filters.page_size)


@router.get(
    "/report-templates/available/",
    response_model=list[ReportTemplateResponse],
    summary="Получение доступных шаблонов отчётов",
    description=("Возвращает список доступных шаблонов отчётов для указанной лаборатории и подразделения."),
    responses={
        200: {"description": "Список доступных шаблонов успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def get_available_report_templates(
    db: DbSession,
    effective: UserPermissions,
    laboratory_id: int = Query(..., description="ID лаборатории"),
    department_id: int | None = Query(None, description="ID подразделения"),
):
    enforce_lab_management_access(effective, laboratory_id, department_id)
    templates, _ = await get_report_templates(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        include_deleted=True,
    )
    return templates


@router.post(
    "/report-templates/",
    response_model=ReportTemplateResponse,
    status_code=201,
    summary="Добавление нового шаблона отчёта",
    description="Добавляет новый шаблон отчёта на основе переданных данных.",
    responses={
        201: {"description": "Шаблон отчёта успешно добавлен"},
        400: {"description": "Некорректные данные для добавления шаблона отчёта"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def create_report_template_endpoint(
    template_data: ReportTemplateCreate,
    db: DbSession,
    effective: UserPermissions,
):
    enforce_lab_management_access(effective, template_data.laboratory_id, template_data.department_id)
    return await create_report_template(db, template_data)


@router.get(
    "/report-templates/{template_id:int}/",
    response_model=None,
    summary="Получение шаблона отчёта по ID",
    description="Возвращает информацию о шаблоне отчёта по его идентификатору или файл при download=true.",
    responses={
        200: {
            "description": "Шаблон отчёта успешно получен",
            "content": {"application/octet-stream": {}},
        },
        403: {"description": "Отказано в доступе"},
        404: {"description": "Шаблон отчёта не найден"},
    },
)
# @IsAuthenticated
async def get_report_template(
    template_id: int,
    db: DbSession,
    effective: UserPermissions,
    download: bool = Query(False, description="Скачать файл шаблона"),
):
    template = await require_report_template_by_id(db, template_id)
    enforce_lab_management_access(effective, template.laboratory_id, template.department_id)
    if download:
        file_data, filename = get_report_template_download(template)
        return build_attachment_response(file_data, filename, "application/octet-stream")
    return template


@router.patch(
    "/report-templates/{template_id:int}/",
    response_model=ReportTemplateResponse,
    summary="Обновление шаблона отчёта",
    description="Обновляет существующий шаблон отчёта.",
    responses={
        200: {"description": "Шаблон отчёта успешно обновлен"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Шаблон отчёта не найден"},
    },
)
# @IsAuthenticated
async def update_report_template_endpoint(
    template_id: int,
    template_data: ReportTemplateUpdate,
    db: DbSession,
    effective: UserPermissions,
):
    template = await require_report_template_by_id(db, template_id)
    enforce_lab_management_access(effective, template.laboratory_id, template.department_id)
    return await update_report_template(db, template, template_data)


@router.post(
    "/report-templates/generate/sample-count/",
    summary="Формирование отчёта «Количество проб» (ИЛНиНМ)",
    description=(
        "Формирует отчёт «Количество проб» для лаборатории ИЛНиНМ и возвращает Excel-файл. "
        "Для каждого филиала копируется блок шаблона с заполнением столбца B."
    ),
    responses={
        200: {
            "description": "Excel-файл отчёта",
            "content": {"application/zip": {}},
        },
        400: {"description": "Лаборатория не ИЛНиНМ или нет шаблона"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Лаборатория или шаблон не найдены"},
    },
)
# @IsAuthenticated
async def generate_sample_count_report(
    body: GenerateSampleCountReportRequest,
    db: DbSession,
    effective: UserPermissions,
):
    enforce_nav_access(effective, "samples", body.laboratory_id, body.department_id)
    content, filename = await generate_sample_count_report_file(db, body)
    return build_attachment_response(content, filename, "application/zip")


@router.post(
    "/report-templates/generate/physicochemical-characteristic/",
    summary="Формирование отчёта «Физико-химическая характеристика» (ИЛНиНМ)",
    description=(
        "Формирует отчёт «Физико-химическая характеристика» для лаборатории ИЛНиНМ "
        "и возвращает Excel-файл за период по дате отбора пробы для цеха ЦДГГКН №1 или №2."
    ),
    responses={
        200: {
            "description": "Excel-файл отчёта",
            "content": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {}},
        },
        400: {"description": "Некорректные параметры или лаборатория не ИЛНиНМ"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Лаборатория или шаблон не найдены"},
    },
)
# @IsAuthenticated
async def generate_physicochemical_report(
    body: GeneratePhysicochemicalReportRequest,
    db: DbSession,
    effective: UserPermissions,
):
    enforce_nav_access(effective, "samples", body.laboratory_id, body.department_id)
    content, filename, media_type = await generate_physicochemical_report_file(db, body)
    return build_attachment_response(content, filename, media_type)


@router.post(
    "/report-templates/generate/kgs-results/",
    summary="Формирование отчёта «Результаты КГС» (ИЛНиНМ)",
    description=(
        "Формирует отчёт «Результаты КГС» для лаборатории ИЛНиНМ и возвращает Excel-файл "
        "за период по дате отбора пробы: паспортизация, дегазированный конденсат."
    ),
    responses={
        200: {
            "description": "Excel-файл отчёта",
            "content": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {}},
        },
        400: {"description": "Некорректные параметры или лаборатория не ИЛНиНМ"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Лаборатория или шаблон не найдены"},
    },
)
# @IsAuthenticated
async def generate_kgs_report(
    body: GenerateKgsReportRequest,
    db: DbSession,
    effective: UserPermissions,
):
    enforce_nav_access(effective, "samples", body.laboratory_id, body.department_id)
    content, filename, media_type = await generate_kgs_report_file(db, body)
    return build_attachment_response(content, filename, media_type)


@router.post(
    "/report-templates/generate/nks-results/",
    summary="Формирование отчёта «Результаты НКС» (ИЛНиНМ)",
    description=(
        "Формирует отчёт «Результаты НКС» для лаборатории ИЛНиНМ и возвращает Excel-файл "
        "за период по дате отбора пробы: нефтеконденсатная смесь."
    ),
    responses={
        200: {
            "description": "Excel-файл отчёта",
            "content": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {}},
        },
        400: {"description": "Некорректные параметры или лаборатория не ИЛНиНМ"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Лаборатория или шаблон не найдены"},
    },
)
# @IsAuthenticated
async def generate_nks_report(
    body: GenerateNksReportRequest,
    db: DbSession,
    effective: UserPermissions,
):
    enforce_nav_access(effective, "samples", body.laboratory_id, body.department_id)
    content, filename, media_type = await generate_nks_report_file(db, body)
    return build_attachment_response(content, filename, media_type)
