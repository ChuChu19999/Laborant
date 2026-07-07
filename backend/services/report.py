from __future__ import annotations
import zipfile
from io import BytesIO
from typing import List, Optional
import pendulum
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import NotFoundError, ValidationError
from models.report import ReportTemplate, ReportType
from repositories import laboratory as laboratory_repo
from repositories import report as report_repo
from repositories.base import flush_entity
from schemas.report import (
    GenerateKgsReportRequest,
    GenerateNksReportRequest,
    GeneratePhysicochemicalReportRequest,
    GenerateSampleCountReportRequest,
    ReportTemplateCreate,
    ReportTemplateResponse,
    ReportTemplateUpdate,
)
from services.ilninm_reports import LABORATORY_NAME_ILNINM
from services.ilninm_reports.kgs_generator import build_kgs_excel
from services.ilninm_reports.nks_generator import build_nks_excel
from services.ilninm_reports.physicochemical_generator import (
    build_physicochemical_excel,
)
from services.ilninm_reports.sample_count_generator import build_sample_count_excel
from services.visibility import validate_lab_and_department
from utils.ilninm_sampling_location import resolve_sampling_location_db_name
from utils.pagination import calculate_total_pages

_EXCEL_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def require_active_report_template(template: ReportTemplate) -> ReportTemplate:
    """Отклоняет мягко удалённый шаблон (deleted_at не NULL)."""
    if template.deleted_at is not None:
        raise NotFoundError("Шаблон отчёта удалён")
    return template


async def get_report_template_by_id(
    db: AsyncSession, template_id: int, include_deleted: bool = False
) -> Optional[ReportTemplate]:
    """Получить шаблон отчёта по ID."""
    return await report_repo.get_report_template_by_id(db, template_id, include_deleted)


async def get_latest_report_template(
    db: AsyncSession,
    *,
    laboratory_id: int,
    report_type: str,
    department_id: Optional[int] = None,
) -> Optional[ReportTemplate]:
    """Последняя неудалённая версия шаблона для лаборатории и подразделения."""
    return await report_repo.get_latest_report_template(
        db,
        laboratory_id=laboratory_id,
        report_type=report_type,
        department_id=department_id,
    )


async def get_report_templates(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
    include_deleted: bool = False,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[List[ReportTemplate], int, int]:
    """Получить список шаблонов отчётов."""
    templates, total = await report_repo.get_report_templates(
        db,
        laboratory_id,
        department_id,
        include_deleted,
        page,
        page_size,
        sort_by,
        sort_order,
    )

    if page is not None and page_size is not None:
        total_pages = calculate_total_pages(total, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    return templates, total, total_pages


async def create_report_template(
    db: AsyncSession, template_data: ReportTemplateCreate
) -> ReportTemplate:
    """Создать шаблон отчёта."""
    await validate_lab_and_department(
        db, template_data.laboratory_id, template_data.department_id
    )

    latest_template = await report_repo.get_latest_report_template_for_type(
        db,
        template_data.report_type,
        template_data.laboratory_id,
        template_data.department_id,
    )

    if latest_template:
        try:
            current_num = int(latest_template.version[1:])
            next_version = f"v{current_num + 1}"
        except (ValueError, IndexError):
            next_version = "v1"
    else:
        next_version = "v1"

    template = ReportTemplate(
        report_type=template_data.report_type,
        version=next_version,
        file=template_data.file,
        file_name=template_data.file_name,
        laboratory_id=template_data.laboratory_id,
        department_id=template_data.department_id,
    )
    return await report_repo.add_report_template(db, template)


async def update_report_template(
    db: AsyncSession, template_id: int, template_data: ReportTemplateUpdate
) -> ReportTemplate:
    """Обновить шаблон отчёта."""
    template = await get_report_template_by_id(db, template_id)
    if not template:
        raise NotFoundError("Шаблон отчёта не найден")

    update_data = template_data.model_dump(exclude_unset=True)

    if "file" in update_data and update_data["file"]:
        template.soft_delete()
        await flush_entity(db)

        latest_template = await report_repo.get_latest_report_template_for_type(
            db,
            template.report_type,
            template.laboratory_id,
            template.department_id,
        )

        if latest_template:
            try:
                current_num = int(latest_template.version[1:])
                next_version = f"v{current_num + 1}"
            except (ValueError, IndexError):
                next_version = "v1"
        else:
            try:
                current_num = int(template.version[1:])
                next_version = f"v{current_num + 1}"
            except (ValueError, IndexError):
                next_version = "v1"

        new_template = ReportTemplate(
            report_type=update_data.get("report_type", template.report_type),
            version=next_version,
            file=update_data["file"],
            file_name=update_data.get("file_name", template.file_name),
            laboratory_id=template.laboratory_id,
            department_id=template.department_id,
        )
        return await report_repo.add_report_template(db, new_template)

    for key, value in update_data.items():
        if key != "file":
            setattr(template, key, value)

    await flush_entity(db)
    return template


def build_report_template_response(template: ReportTemplate) -> ReportTemplateResponse:
    """Собрать ответ API по шаблону отчёта с наименованиями связей."""
    template_dict = ReportTemplateResponse.model_validate(template).model_dump()
    if template.laboratory:
        template_dict["laboratory_name"] = template.laboratory.name
    if template.department:
        template_dict["department_name"] = template.department.name
    return ReportTemplateResponse(**template_dict)


async def get_report_template_response_data(
    db: AsyncSession, template_id: int
) -> ReportTemplateResponse:
    """Получить шаблон отчёта с данными для ответа API."""
    template = await report_repo.get_report_template_by_id(db, template_id)
    if not template:
        raise NotFoundError("Шаблон отчёта не найден")
    return build_report_template_response(template)


async def get_laboratory_by_id(db: AsyncSession, laboratory_id: int):
    """Получить лабораторию по ID."""
    return await laboratory_repo.get_laboratory_by_id(db, laboratory_id)


def parse_report_period_bounds(date_from, date_to):
    """Преобразует date из схемы в границы периода для отчётов."""
    try:
        return (
            pendulum.datetime(date_from.year, date_from.month, date_from.day).start_of(
                "day"
            ),
            pendulum.datetime(date_to.year, date_to.month, date_to.day).end_of("day"),
        )
    except Exception as exc:
        raise ValidationError("Некорректный формат дат (ожидается YYYY-MM-DD)") from exc


async def resolve_ilninm_report_template(
    db: AsyncSession,
    laboratory_id: int,
    report_type: str,
    template_id: Optional[int],
    department_id: Optional[int],
    report_type_label: str,
    template_not_found_msg: str,
) -> ReportTemplate:
    """Проверить лабораторию ИЛНиНМ и вернуть активный шаблон отчёта."""
    lab = await get_laboratory_by_id(db, laboratory_id)
    if not lab:
        raise NotFoundError("Лаборатория не найдена")
    if lab.name != LABORATORY_NAME_ILNINM:
        raise ValidationError(
            f"Отчёт «{report_type_label}» доступен только "
            f"для лаборатории «{LABORATORY_NAME_ILNINM}»"
        )

    if template_id:
        template = await get_report_template_by_id(db, template_id)
        if not template:
            raise NotFoundError("Шаблон отчёта не найден")
        if template.report_type != report_type:
            raise ValidationError(f"Шаблон должен быть типа «{report_type_label}»")
        if template.laboratory_id != laboratory_id:
            raise ValidationError("Шаблон не принадлежит выбранной лаборатории")
    else:
        template = await get_latest_report_template(
            db,
            laboratory_id=laboratory_id,
            report_type=report_type,
            department_id=department_id,
        )
        if not template:
            raise NotFoundError(template_not_found_msg)

    return require_active_report_template(template)


async def generate_sample_count_report_file(
    db: AsyncSession, body: GenerateSampleCountReportRequest
) -> tuple[bytes, str]:
    """Сформировать zip-архив отчёта «Количество проб»."""
    template = await resolve_ilninm_report_template(
        db,
        laboratory_id=body.laboratory_id,
        report_type=ReportType.SAMPLE_COUNT.value,
        template_id=body.template_id,
        department_id=body.department_id,
        report_type_label="Количество проб",
        template_not_found_msg=(
            "Не найден шаблон отчёта «Количество проб» для данной лаборатории"
            + (" и подразделения" if body.department_id is not None else "")
        ),
    )

    date_from, date_to = parse_report_period_bounds(body.date_from, body.date_to)

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
    return zip_buffer.getvalue(), filename


async def generate_physicochemical_report_file(
    db: AsyncSession, body: GeneratePhysicochemicalReportRequest
) -> tuple[bytes, str, str]:
    """Сформировать Excel-файл отчёта «Физико-химическая характеристика»."""
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
    return excel_bytes, filename, _EXCEL_MEDIA_TYPE


async def generate_kgs_report_file(
    db: AsyncSession, body: GenerateKgsReportRequest
) -> tuple[bytes, str, str]:
    """Сформировать Excel-файл отчёта «Результаты КГС»."""
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
    return excel_bytes, filename, _EXCEL_MEDIA_TYPE


async def generate_nks_report_file(
    db: AsyncSession, body: GenerateNksReportRequest
) -> tuple[bytes, str, str]:
    """Сформировать Excel-файл отчёта «Результаты НКС»."""
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
    return excel_bytes, filename, _EXCEL_MEDIA_TYPE
