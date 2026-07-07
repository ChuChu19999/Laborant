from __future__ import annotations
import base64
from typing import Optional
from fastapi import APIRouter, Depends, Query
from core.auth_decorators import IsAuthenticated
from core.deps import DbSession, ScopeSortPaginationParams
from core.exceptions import NotFoundError, ValidationError
from models.report import ReportType
from schemas.pagination import PaginatedResponse
from schemas.report import (
    GenerateKgsReportRequest,
    GenerateNksReportRequest,
    GeneratePhysicochemicalReportRequest,
    GenerateSampleCountReportRequest,
    ReportTemplateCreate,
    ReportTemplateResponse,
    ReportTemplateUpdate,
)
from services.ilninm_reports.kgs_generator import build_kgs_excel
from services.ilninm_reports.nks_generator import build_nks_excel
from services.ilninm_reports.physicochemical_generator import (
    build_physicochemical_excel,
)
from services.report import (
    build_report_template_response,
    create_report_template,
    generate_sample_count_report_file,
    get_report_template_by_id,
    get_report_template_response_data,
    get_report_templates,
    parse_report_period_bounds,
    resolve_ilninm_report_template,
    update_report_template,
)
from utils.http_attachment import build_attachment_response
from utils.ilninm_sampling_location import resolve_sampling_location_db_name

router = APIRouter()

_EXCEL_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get(
    "/report-templates/",
    response_model=PaginatedResponse[ReportTemplateResponse],
    summary="Получение списка шаблонов отчётов",
    description=(
        "Возвращает список шаблонов отчётов с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает фильтрацию по лабораториям и подразделениям, сортировку."
    ),
    responses={200: {"description": "Список шаблонов отчётов успешно получен"}},
)
# @IsAuthenticated
async def list_report_templates(
    db: DbSession,
    params: ScopeSortPaginationParams = Depends(),
    include_deleted: bool = Query(False),
):
    """Возвращает список шаблонов отчётов с пагинацией или без."""
    templates, total, total_pages = await get_report_templates(
        db,
        laboratory_id=params.laboratory_id,
        department_id=params.department_id,
        include_deleted=include_deleted,
        page=params.page,
        page_size=params.page_size,
        sort_by=params.sort_by,
        sort_order=params.sort_order,
    )

    items = [build_report_template_response(template) for template in templates]

    return PaginatedResponse(
        items=items,
        total=total,
        page=params.page if params.page is not None else 1,
        page_size=params.page_size if params.page_size is not None else total,
        total_pages=total_pages,
    )


@router.get(
    "/report-templates/available/",
    response_model=list[ReportTemplateResponse],
    summary="Получение доступных шаблонов отчётов",
    description=(
        "Возвращает список доступных шаблонов отчётов для указанной лаборатории и подразделения."
    ),
    responses={200: {"description": "Список доступных шаблонов успешно получен"}},
)
# @IsAuthenticated
async def get_available_report_templates(
    db: DbSession,
    laboratory_id: int = Query(..., description="ID лаборатории"),
    department_id: Optional[int] = Query(None, description="ID подразделения"),
):
    """Возвращает список доступных шаблонов отчётов для указанной лаборатории и подразделения."""
    templates, _, _ = await get_report_templates(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        include_deleted=True,
    )

    items = [build_report_template_response(template) for template in templates]

    return items


@router.post(
    "/report-templates/",
    response_model=ReportTemplateResponse,
    status_code=201,
    summary="Добавление нового шаблона отчёта",
    description="Добавляет новый шаблон отчёта на основе переданных данных.",
    responses={
        201: {"description": "Шаблон отчёта успешно добавлен"},
        400: {"description": "Некорректные данные для добавления шаблона отчёта"},
    },
)
# @IsAuthenticated
async def create_report_template_endpoint(
    template_data: ReportTemplateCreate,
    db: DbSession,
):
    """Добавляет новый шаблон отчёта на основе переданных данных."""
    template = await create_report_template(db, template_data)
    return await get_report_template_response_data(db, template.id)


@router.get(
    "/report-templates/{template_id}/",
    summary="Получение шаблона отчёта по ID",
    description="Возвращает информацию о шаблоне отчёта по его идентификатору или файл при download=true.",
    responses={
        200: {"description": "Шаблон отчёта успешно получен"},
        404: {"description": "Шаблон отчёта не найден"},
    },
)
# @IsAuthenticated
async def get_report_template(
    template_id: int,
    db: DbSession,
    download: bool = Query(False, description="Скачать файл шаблона"),
):
    """Возвращает информацию о шаблоне отчёта по его идентификатору или файл при download=true."""
    template = await get_report_template_by_id(db, template_id)
    if not template:
        raise NotFoundError("Шаблон отчёта не найден")

    if download:
        file_data = base64.b64decode(template.file)
        return build_attachment_response(
            file_data, template.file_name, "application/octet-stream"
        )

    return build_report_template_response(template)


@router.patch(
    "/report-templates/{template_id}/",
    response_model=ReportTemplateResponse,
    summary="Обновление шаблона отчёта",
    description="Обновляет существующий шаблон отчёта.",
    responses={
        200: {"description": "Шаблон отчёта успешно обновлен"},
        404: {"description": "Шаблон отчёта не найден"},
    },
)
# @IsAuthenticated
async def update_report_template_endpoint(
    template_id: int,
    template_data: ReportTemplateUpdate,
    db: DbSession,
):
    """Обновляет существующий шаблон отчёта."""
    template = await update_report_template(db, template_id, template_data)
    return await get_report_template_response_data(db, template.id)


@router.post(
    "/report-templates/generate/sample-count/",
    summary="Формирование отчёта «Количество проб» (ИЛНиНМ)",
    description=(
        "Формирует отчёт «Количество проб» для лаборатории ИЛНиНМ и возвращает Excel-файл. "
        "Для каждого филиала копируется блок шаблона с заполнением столбца B."
    ),
    responses={
        200: {"description": "Excel-файл отчёта"},
        400: {"description": "Лаборатория не ИЛНиНМ или нет шаблона"},
        404: {"description": "Лаборатория или шаблон не найдены"},
    },
)
# @IsAuthenticated
async def generate_sample_count_report(
    body: GenerateSampleCountReportRequest,
    db: DbSession,
):
    """Формирует отчёт «Количество проб» и возвращает Excel-файл."""
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
        200: {"description": "Excel-файл отчёта"},
        400: {"description": "Некорректные параметры или лаборатория не ИЛНиНМ"},
        404: {"description": "Лаборатория или шаблон не найдены"},
    },
)
# @IsAuthenticated
async def generate_physicochemical_report(
    body: GeneratePhysicochemicalReportRequest,
    db: DbSession,
):
    """Формирует отчёт «Физико-химическая характеристика» и возвращает Excel-файл."""
    template = await resolve_ilninm_report_template(
        db,
        laboratory_id=body.laboratory_id,
        report_type=ReportType.PHYSICOCHEMICAL_CHARACTERISTIC.value,
        template_id=body.template_id,
        department_id=body.department_id,
        report_type_label="Физико-химическая характеристика",
        template_not_found_msg=(
            "Не найден шаблон отчёта «Физико-химическая характеристика» "
            "для данной лаборатории"
            + (" и подразделения" if body.department_id is not None else "")
        ),
    )

    try:
        resolve_sampling_location_db_name(body.sampling_location)
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc

    date_from, date_to = parse_report_period_bounds(body.date_from, body.date_to)

    excel_bytes = await build_physicochemical_excel(
        db,
        template_file_base64=template.file,
        laboratory_id=body.laboratory_id,
        sampling_date_from=date_from,
        sampling_date_to=date_to,
        sampling_location=body.sampling_location,
        department_id=body.department_id,
    )

    location_slug = body.sampling_location.replace(" ", "_")
    filename = (
        f"Физико_химическая_характеристика_{location_slug}_"
        f"{body.date_from}_{body.date_to}.xlsx"
    )
    return build_attachment_response(excel_bytes, filename, _EXCEL_MEDIA_TYPE)


@router.post(
    "/report-templates/generate/kgs-results/",
    summary="Формирование отчёта «Результаты КГС» (ИЛНиНМ)",
    description=(
        "Формирует отчёт «Результаты КГС» для лаборатории ИЛНиНМ и возвращает Excel-файл "
        "за период по дате отбора пробы: паспортизация, дегазированный конденсат."
    ),
    responses={
        200: {"description": "Excel-файл отчёта"},
        400: {"description": "Некорректные параметры или лаборатория не ИЛНиНМ"},
        404: {"description": "Лаборатория или шаблон не найдены"},
    },
)
# @IsAuthenticated
async def generate_kgs_report(
    body: GenerateKgsReportRequest,
    db: DbSession,
):
    """Формирует отчёт «Результаты КГС» и возвращает Excel-файл."""
    template = await resolve_ilninm_report_template(
        db,
        laboratory_id=body.laboratory_id,
        report_type=ReportType.KGS_RESULTS.value,
        template_id=body.template_id,
        department_id=body.department_id,
        report_type_label="Результаты КГС",
        template_not_found_msg=(
            "Не найден шаблон отчёта «Результаты КГС» для данной лаборатории"
            + (" и подразделения" if body.department_id is not None else "")
        ),
    )

    date_from, date_to = parse_report_period_bounds(body.date_from, body.date_to)

    excel_bytes = await build_kgs_excel(
        db,
        template_file_base64=template.file,
        laboratory_id=body.laboratory_id,
        sampling_date_from=date_from,
        sampling_date_to=date_to,
        department_id=body.department_id,
    )

    filename = f"Результаты_КГС_{body.date_from}_{body.date_to}.xlsx"
    return build_attachment_response(excel_bytes, filename, _EXCEL_MEDIA_TYPE)


@router.post(
    "/report-templates/generate/nks-results/",
    summary="Формирование отчёта «Результаты НКС» (ИЛНиНМ)",
    description=(
        "Формирует отчёт «Результаты НКС» для лаборатории ИЛНиНМ и возвращает Excel-файл "
        "за период по дате отбора пробы: нефтеконденсатная смесь."
    ),
    responses={
        200: {"description": "Excel-файл отчёта"},
        400: {"description": "Некорректные параметры или лаборатория не ИЛНиНМ"},
        404: {"description": "Лаборатория или шаблон не найдены"},
    },
)
# @IsAuthenticated
async def generate_nks_report(
    body: GenerateNksReportRequest,
    db: DbSession,
):
    """Формирует отчёт «Результаты НКС» и возвращает Excel-файл."""
    template = await resolve_ilninm_report_template(
        db,
        laboratory_id=body.laboratory_id,
        report_type=ReportType.NKS_RESULTS.value,
        template_id=body.template_id,
        department_id=body.department_id,
        report_type_label="Результаты НКС",
        template_not_found_msg=(
            "Не найден шаблон отчёта «Результаты НКС» для данной лаборатории"
            + (" и подразделения" if body.department_id is not None else "")
        ),
    )

    date_from, date_to = parse_report_period_bounds(body.date_from, body.date_to)

    excel_bytes = await build_nks_excel(
        db,
        template_file_base64=template.file,
        laboratory_id=body.laboratory_id,
        sampling_date_from=date_from,
        sampling_date_to=date_to,
        report_month=body.report_month,
        report_year=body.report_year,
        department_id=body.department_id,
    )

    filename = f"Результаты_НКС_{body.date_from}_{body.date_to}.xlsx"
    return build_attachment_response(excel_bytes, filename, _EXCEL_MEDIA_TYPE)
