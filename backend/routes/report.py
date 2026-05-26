import zipfile
from io import BytesIO
from typing import Optional
from urllib.parse import quote
import pendulum
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from core.database import get_db
from core.exceptions import NotFoundError, ValidationError
from core.security import IsAuthenticated
from models.laboratory import Laboratory
from models.report import ReportTemplate, ReportType
from schemas.pagination import PaginatedResponse
from schemas.report import (
    GeneratePhysicochemicalReportRequest,
    GenerateSampleCountReportRequest,
    ReportTemplateCreate,
    ReportTemplateResponse,
    ReportTemplateUpdate,
)
from services.ilninm_reports import LABORATORY_NAME_ILNINM
from services.ilninm_reports.physicochemical_generator import (
    build_physicochemical_excel,
)
from services.ilninm_reports.sample_count_generator import build_sample_count_excel
from services.report import (
    create_report_template,
    delete_report_template,
    get_latest_report_template,
    get_report_template_by_id,
    get_report_templates,
    require_active_report_template,
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
    responses={200: {"description": "Список шаблонов отчётов успешно получен"}},
)
# @IsAuthenticated
async def list_report_templates(
    laboratory_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    include_deleted: bool = Query(False),
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает список шаблонов отчётов с пагинацией или без."""
    templates, total, total_pages = await get_report_templates(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        include_deleted=include_deleted,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    items = []
    for template in templates:
        template_dict = ReportTemplateResponse.model_validate(template).model_dump()
        if template.laboratory:
            template_dict["laboratory_name"] = template.laboratory.name
        if template.department:
            template_dict["department_name"] = template.department.name
        items.append(ReportTemplateResponse(**template_dict))

    return PaginatedResponse(
        items=items,
        total=total,
        page=page if page is not None else 1,
        page_size=page_size if page_size is not None else total,
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
    laboratory_id: int = Query(..., description="ID лаборатории"),
    department_id: Optional[int] = Query(None, description="ID подразделения"),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает список доступных шаблонов отчётов для указанной лаборатории и подразделения."""
    templates, _, _ = await get_report_templates(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        include_deleted=True,
    )

    items = []
    for template in templates:
        template_dict = ReportTemplateResponse.model_validate(template).model_dump()
        if template.laboratory:
            template_dict["laboratory_name"] = template.laboratory.name
        if template.department:
            template_dict["department_name"] = template.department.name
        items.append(ReportTemplateResponse(**template_dict))

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
    db: AsyncSession = Depends(get_db),
):
    """Добавляет новый шаблон отчёта на основе переданных данных."""
    from models.report import ReportTemplate

    template = await create_report_template(db, template_data)
    await db.commit()
    query = (
        select(ReportTemplate)
        .where(ReportTemplate.id == template.id)
        .options(
            selectinload(ReportTemplate.laboratory),
            selectinload(ReportTemplate.department),
        )
    )
    result = await db.execute(query)
    template = result.scalar_one()
    template_dict = ReportTemplateResponse.model_validate(template).model_dump()
    if template.laboratory:
        template_dict["laboratory_name"] = template.laboratory.name
    if template.department:
        template_dict["department_name"] = template.department.name
    return ReportTemplateResponse(**template_dict)


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
    download: bool = Query(False, description="Скачать файл шаблона"),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает информацию о шаблоне отчёта по его идентификатору или файл при download=true."""
    template = await get_report_template_by_id(db, template_id)
    if not template:
        raise NotFoundError("Шаблон отчёта не найден")

    if download:
        import base64

        file_data = base64.b64decode(template.file)
        encoded_filename = quote(template.file_name, safe="")
        content_disposition = f"attachment; filename*=UTF-8''{encoded_filename}"
        return Response(
            content=file_data,
            media_type="application/octet-stream",
            headers={"Content-Disposition": content_disposition},
        )

    template_dict = ReportTemplateResponse.model_validate(template).model_dump()
    if template.laboratory:
        template_dict["laboratory_name"] = template.laboratory.name
    if template.department:
        template_dict["department_name"] = template.department.name
    return ReportTemplateResponse(**template_dict)


@router.patch(
    "/report-templates/{template_id}/",
    response_model=ReportTemplateResponse,
    summary="Обновление шаблона отчёта",
    description="Обновляет существующий шаблон отчёта. Можно обновить только указанные поля.",
    responses={
        200: {"description": "Шаблон отчёта успешно обновлен"},
        404: {"description": "Шаблон отчёта не найден"},
    },
)
# @IsAuthenticated
async def update_report_template_endpoint(
    template_id: int,
    template_data: ReportTemplateUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Обновляет существующий шаблон отчёта. Можно обновить только указанные поля."""
    from models.report import ReportTemplate

    template = await update_report_template(db, template_id, template_data)
    await db.commit()
    query = (
        select(ReportTemplate)
        .where(ReportTemplate.id == template.id)
        .options(
            selectinload(ReportTemplate.laboratory),
            selectinload(ReportTemplate.department),
        )
    )
    result = await db.execute(query)
    template = result.scalar_one()
    template_dict = ReportTemplateResponse.model_validate(template).model_dump()
    if template.laboratory:
        template_dict["laboratory_name"] = template.laboratory.name
    if template.department:
        template_dict["department_name"] = template.department.name
    return ReportTemplateResponse(**template_dict)


@router.delete(
    "/report-templates/{template_id}/",
    status_code=204,
    summary="Удаление шаблона отчёта",
    description="Выполняет мягкое удаление шаблона отчёта. Шаблон помечается как удаленный.",
    responses={
        204: {"description": "Шаблон отчёта успешно удален"},
        404: {"description": "Шаблон отчёта не найден"},
    },
)
# @IsAuthenticated
async def delete_report_template_endpoint(
    template_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Выполняет мягкое удаление шаблона отчёта. Шаблон помечается как удаленный."""
    await delete_report_template(db, template_id)
    await db.commit()


@router.post(
    "/report-templates/generate/sample-count/",
    summary="Сформировать отчёт «Количество проб» (ИЛНиНМ)",
    description=(
        "Доступно только для лаборатории с названием ИЛНиНМ. "
        "Возвращает Excel-файл: для каждого филиала копируется блок шаблона с заполнением столбца B."
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
    db: AsyncSession = Depends(get_db),
):
    """Формирует отчёт «Количество проб» и возвращает Excel-файл."""
    lab_result = await db.execute(
        select(Laboratory).where(Laboratory.id == body.laboratory_id)
    )
    lab = lab_result.scalar_one_or_none()
    if not lab:
        raise NotFoundError("Лаборатория не найдена")
    if lab.name != LABORATORY_NAME_ILNINM:
        raise ValidationError(
            f"Отчёт «Количество проб» доступен только для лаборатории «{LABORATORY_NAME_ILNINM}»"
        )

    if body.template_id:
        template = await get_report_template_by_id(db, body.template_id)
        if not template:
            raise NotFoundError("Шаблон отчёта не найден")
        if template.report_type != ReportType.SAMPLE_COUNT.value:
            raise ValidationError("Шаблон должен быть типа «Количество проб»")
        if template.laboratory_id != body.laboratory_id:
            raise ValidationError("Шаблон не принадлежит выбранной лаборатории")
    else:
        template = await get_latest_report_template(
            db,
            laboratory_id=body.laboratory_id,
            report_type=ReportType.SAMPLE_COUNT.value,
            department_id=body.department_id,
        )
        if not template:
            raise NotFoundError(
                "Не найден шаблон отчёта «Количество проб» для данной лаборатории"
                + (" и подразделения" if body.department_id is not None else "")
            )

    require_active_report_template(template)

    try:
        date_from = pendulum.parse(body.date_from).start_of("day")
        date_to = pendulum.parse(body.date_to).end_of("day")
    except Exception:
        raise ValidationError("Некорректный формат дат (ожидается YYYY-MM-DD)")

    excel_bytes, txt_bytes = await build_sample_count_excel(
        db,
        template_file_base64=template.file,
        laboratory_id=body.laboratory_id,
        receiving_date_from=date_from,
        receiving_date_to=date_to,
        department_id=body.department_id,
    )

    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            f"Количество_проб_{body.date_from}_{body.date_to}.xlsx",
            excel_bytes,
        )
        zf.writestr(
            f"Количество_проб_{body.date_from}_{body.date_to}.txt",
            txt_bytes,
        )

    filename = f"Количество_проб_{body.date_from}_{body.date_to}.zip"
    encoded_filename = quote(filename, safe="")
    content_disposition = f"attachment; filename*=UTF-8''{encoded_filename}"
    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": content_disposition},
    )


@router.post(
    "/report-templates/generate/physicochemical-characteristic/",
    summary="Сформировать отчёт «Физико-химическая характеристика» (ИЛНиНМ)",
    description=(
        "Доступно только для лаборатории с названием ИЛНиНМ. "
        "Возвращает Excel-файл за период по дате отбора пробы для цеха ЦДГГКН №1 или №2."
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
    db: AsyncSession = Depends(get_db),
):
    """Формирует отчёт «Физико-химическая характеристика» и возвращает Excel-файл."""
    lab_result = await db.execute(
        select(Laboratory).where(Laboratory.id == body.laboratory_id)
    )
    lab = lab_result.scalar_one_or_none()
    if not lab:
        raise NotFoundError("Лаборатория не найдена")
    if lab.name != LABORATORY_NAME_ILNINM:
        raise ValidationError(
            f"Отчёт «Физико-химическая характеристика» доступен только "
            f"для лаборатории «{LABORATORY_NAME_ILNINM}»"
        )

    if body.template_id:
        template = await get_report_template_by_id(db, body.template_id)
        if not template:
            raise NotFoundError("Шаблон отчёта не найден")
        if template.report_type != ReportType.PHYSICOCHEMICAL_CHARACTERISTIC.value:
            raise ValidationError(
                "Шаблон должен быть типа «Физико-химическая характеристика»"
            )
        if template.laboratory_id != body.laboratory_id:
            raise ValidationError("Шаблон не принадлежит выбранной лаборатории")
    else:
        template = await get_latest_report_template(
            db,
            laboratory_id=body.laboratory_id,
            report_type=ReportType.PHYSICOCHEMICAL_CHARACTERISTIC.value,
            department_id=body.department_id,
        )
        if not template:
            raise NotFoundError(
                "Не найден шаблон отчёта «Физико-химическая характеристика» "
                "для данной лаборатории"
                + (" и подразделения" if body.department_id is not None else "")
            )

    require_active_report_template(template)

    try:
        date_from = pendulum.parse(body.date_from).start_of("day")
        date_to = pendulum.parse(body.date_to).end_of("day")
    except Exception:
        raise ValidationError("Некорректный формат дат (ожидается YYYY-MM-DD)")

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
    encoded_filename = quote(filename, safe="")
    content_disposition = f"attachment; filename*=UTF-8''{encoded_filename}"
    return Response(
        content=excel_bytes,
        media_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        headers={"Content-Disposition": content_disposition},
    )
