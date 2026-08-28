from __future__ import annotations
import base64
from datetime import date
from io import BytesIO
import zipfile
import pendulum
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import DomainValidationError, NotFoundError
from models.report import ReportTemplate, ReportType
from repositories import report as report_repo
from repositories.base import flush_entity
from schemas.report import (
    GenerateKgsReportRequest,
    GenerateNksReportRequest,
    GeneratePhysicochemicalReportRequest,
    GenerateSampleCountReportRequest,
    ReportTemplateCreate,
    ReportTemplateUpdate,
)
from services.ilninm_reports import LABORATORY_NAME_ILNINM
from services.ilninm_reports.kgs_excel import build_kgs_excel
from services.ilninm_reports.nks_excel import build_nks_excel
from services.ilninm_reports.physicochemical_excel import (
    build_physicochemical_excel,
)
from services.ilninm_reports.sample_count_excel import build_sample_count_excel
from services.laboratory import require_laboratory_by_id
from services.visibility import validate_lab_and_department
from utils.ilninm_reports.sampling_location import resolve_sampling_location_db_name
from utils.versioning import next_version_string

_EXCEL_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def require_active_report_template(template: ReportTemplate) -> ReportTemplate:
    """Отклонить мягко удалённый шаблон (deleted_at не NULL)."""
    if template.deleted_at is not None:
        raise NotFoundError("Шаблон отчёта удалён")
    return template


def get_report_template_download(template: ReportTemplate) -> tuple[bytes, str]:
    """Вернуть байты файла шаблона отчёта и имя для скачивания."""
    return base64.b64decode(template.file), template.file_name


def _pack_sample_count_zip(
    excel_bytes: bytes,
    txt_bytes: bytes,
    date_from: date,
    date_to: date,
) -> tuple[bytes, str]:
    """Собрать zip с xlsx и txt отчёта «Количество проб»."""
    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            f"Количество_проб_{date_from}_{date_to}.xlsx",
            excel_bytes,
        )
        zf.writestr(
            f"Количество_проб_{date_from}_{date_to}.txt",
            txt_bytes,
        )
    filename = f"Количество_проб_{date_from}_{date_to}.zip"
    return zip_buffer.getvalue(), filename


async def get_report_template_by_id(
    db: AsyncSession, template_id: int, include_deleted: bool = False
) -> ReportTemplate | None:
    """Получить шаблон отчёта по ID."""
    return await report_repo.get_report_template_by_id(db, template_id, include_deleted)


async def require_report_template_by_id(
    db: AsyncSession, template_id: int, include_deleted: bool = False
) -> ReportTemplate:
    """Вернуть шаблон отчёта по ID, иначе вызвать NotFoundError."""
    template = await get_report_template_by_id(db, template_id, include_deleted)
    if not template:
        raise NotFoundError("Шаблон отчёта не найден")
    return template


async def get_latest_report_template(
    db: AsyncSession,
    *,
    laboratory_id: int,
    report_type: str,
    department_id: int | None = None,
) -> ReportTemplate | None:
    """Получить последнюю неудалённую версию шаблона для лаборатории и подразделения."""
    return await report_repo.get_latest_report_template(
        db,
        laboratory_id=laboratory_id,
        report_type=report_type,
        department_id=department_id,
    )


async def get_report_templates(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    include_deleted: bool = False,
    page: int | None = None,
    page_size: int | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[ReportTemplate], int]:
    """Получить список шаблонов отчётов."""
    return await report_repo.get_report_templates(
        db,
        laboratory_id,
        department_id,
        include_deleted,
        page,
        page_size,
        sort_by,
        sort_order,
    )


async def create_report_template(db: AsyncSession, template_data: ReportTemplateCreate) -> ReportTemplate:
    """Создать шаблон отчёта."""
    await validate_lab_and_department(db, template_data.laboratory_id, template_data.department_id)

    latest_template = await report_repo.get_latest_report_template(
        db,
        laboratory_id=template_data.laboratory_id,
        report_type=template_data.report_type,
        department_id=template_data.department_id,
    )
    next_version = next_version_string(latest_template.version if latest_template else None)

    template = ReportTemplate(
        report_type=template_data.report_type,
        version=next_version,
        file=template_data.file,
        file_name=template_data.file_name,
        laboratory_id=template_data.laboratory_id,
        department_id=template_data.department_id,
    )
    template = await report_repo.add_report_template(db, template)
    return await require_report_template_by_id(db, template.id)


async def update_report_template(
    db: AsyncSession, template: ReportTemplate, template_data: ReportTemplateUpdate
) -> ReportTemplate:
    """Обновить шаблон отчёта."""
    update_data = template_data.model_dump(exclude_unset=True)

    if update_data.get("file"):
        template.soft_delete()
        await flush_entity(db)

        latest_template = await report_repo.get_latest_report_template(
            db,
            laboratory_id=template.laboratory_id,
            report_type=template.report_type,
            department_id=template.department_id,
        )
        next_version = next_version_string(latest_template.version if latest_template else template.version)

        new_template = ReportTemplate(
            report_type=update_data.get("report_type", template.report_type),
            version=next_version,
            file=update_data["file"],
            file_name=update_data.get("file_name", template.file_name),
            laboratory_id=template.laboratory_id,
            department_id=template.department_id,
        )
        new_template = await report_repo.add_report_template(db, new_template)
        return await require_report_template_by_id(db, new_template.id)

    for key, value in update_data.items():
        if key != "file":
            setattr(template, key, value)

    await flush_entity(db)
    return await require_report_template_by_id(db, template.id)


def parse_report_period_bounds(date_from: date, date_to: date) -> tuple[pendulum.DateTime, pendulum.DateTime]:
    """Преобразовать date из схемы в границы периода для отчётов."""
    try:
        return (
            pendulum.datetime(date_from.year, date_from.month, date_from.day).start_of("day"),
            pendulum.datetime(date_to.year, date_to.month, date_to.day).end_of("day"),
        )
    except (ValueError, TypeError, OverflowError) as exc:
        raise DomainValidationError("Некорректный формат дат (ожидается YYYY-MM-DD)") from exc


async def resolve_ilninm_report_template(
    db: AsyncSession,
    laboratory_id: int,
    report_type: str,
    template_id: int | None,
    department_id: int | None,
    report_type_label: str,
    template_not_found_msg: str,
) -> ReportTemplate:
    """Проверить лабораторию ИЛНиНМ и вернуть активный шаблон отчёта."""
    lab = await require_laboratory_by_id(db, laboratory_id)
    if lab.name != LABORATORY_NAME_ILNINM:
        raise DomainValidationError(
            f"Отчёт «{report_type_label}» доступен только для лаборатории «{LABORATORY_NAME_ILNINM}»"
        )

    if template_id:
        template = await require_report_template_by_id(db, template_id)
        if template.report_type != report_type:
            raise DomainValidationError(f"Шаблон должен быть типа «{report_type_label}»")
        if template.laboratory_id != laboratory_id:
            raise DomainValidationError("Шаблон не принадлежит выбранной лаборатории")
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

    return _pack_sample_count_zip(excel_bytes, txt_bytes, body.date_from, body.date_to)


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
            "для данной лаборатории" + (" и подразделения" if body.department_id is not None else "")
        ),
    )

    try:
        resolve_sampling_location_db_name(body.sampling_location)
    except ValueError as exc:
        raise DomainValidationError(str(exc)) from exc

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
    filename = f"Физико_химическая_характеристика_{location_slug}_{body.date_from}_{body.date_to}.xlsx"
    return excel_bytes, filename, _EXCEL_MEDIA_TYPE


async def generate_kgs_report_file(db: AsyncSession, body: GenerateKgsReportRequest) -> tuple[bytes, str, str]:
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


async def generate_nks_report_file(db: AsyncSession, body: GenerateNksReportRequest) -> tuple[bytes, str, str]:
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
