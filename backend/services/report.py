from typing import List, Optional
from sqlalchemy import desc, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from core.exceptions import NotFoundError, ValidationError
from models.laboratory import Department, Laboratory
from models.report import ReportTemplate
from schemas.report import ReportTemplateCreate, ReportTemplateUpdate
from utils.pagination import apply_pagination, calculate_total_pages, get_total_count
from utils.sorting import build_order_by


async def get_report_template_by_id(
    db: AsyncSession, template_id: int, include_deleted: bool = False
) -> Optional[ReportTemplate]:
    """Получить шаблон отчёта по ID."""
    query = (
        select(ReportTemplate)
        .where(ReportTemplate.id == template_id)
        .options(
            selectinload(ReportTemplate.laboratory),
            selectinload(ReportTemplate.department),
        )
    )
    if not include_deleted:
        query = query.where(ReportTemplate.deleted_at.is_(None))
    result = await db.execute(query)
    return result.scalar_one_or_none()


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
    query = select(ReportTemplate).options(
        selectinload(ReportTemplate.laboratory),
        selectinload(ReportTemplate.department),
    )

    if not include_deleted:
        query = query.where(ReportTemplate.deleted_at.is_(None))

    conditions = []
    if laboratory_id:
        conditions.append(ReportTemplate.laboratory_id == laboratory_id)
    if department_id:
        conditions.append(ReportTemplate.department_id == department_id)
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "report_type": ReportTemplate.report_type,
        "version": ReportTemplate.version,
        "created_at": ReportTemplate.created_at,
    }

    # Если сортировка не указана, сортируем по версии по убыванию (последние версии первыми)
    # Используем числовую сортировку версий: извлекаем число из строки "v1", "v2" и т.д.
    if not sort_by:
        version_num_expr = text(
            "CAST(REGEXP_REPLACE(REGEXP_REPLACE(version, '^[vV]', ''), '[^0-9]', '', 'g') AS INTEGER)"
        )
        query = query.order_by(desc(version_num_expr), ReportTemplate.created_at.desc())
    else:
        order_by = build_order_by(
            sort_by, sort_order, sort_mapping, ReportTemplate.created_at
        )
        query = query.order_by(order_by)

    count_query = select(func.count()).select_from(ReportTemplate)
    if not include_deleted:
        count_query = count_query.where(ReportTemplate.deleted_at.is_(None))
    count_conditions = []
    if laboratory_id:
        count_conditions.append(ReportTemplate.laboratory_id == laboratory_id)
    if department_id:
        count_conditions.append(ReportTemplate.department_id == department_id)
    if count_conditions:
        count_query = count_query.where(*count_conditions)

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        total_pages = calculate_total_pages(total, page_size)
        query = apply_pagination(query, page, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    result = await db.execute(query)
    templates = result.scalars().all()

    return templates, total, total_pages


async def create_report_template(
    db: AsyncSession, template_data: ReportTemplateCreate
) -> ReportTemplate:
    """Создать шаблон отчёта."""
    laboratory = await db.execute(
        select(Laboratory).where(Laboratory.id == template_data.laboratory_id)
    )
    if not laboratory.scalar_one_or_none():
        raise NotFoundError("Лаборатория не найдена")

    if template_data.department_id:
        department = await db.execute(
            select(Department).where(Department.id == template_data.department_id)
        )
        dept = department.scalar_one_or_none()
        if not dept:
            raise NotFoundError("Подразделение не найдено")
        if dept.laboratory_id != template_data.laboratory_id:
            raise ValidationError(
                "Подразделение должно принадлежать выбранной лаборатории"
            )

    latest = await db.execute(
        select(ReportTemplate)
        .where(
            ReportTemplate.report_type == template_data.report_type,
            ReportTemplate.laboratory_id == template_data.laboratory_id,
            ReportTemplate.department_id == template_data.department_id,
            ReportTemplate.deleted_at.is_(None),
        )
        .order_by(ReportTemplate.version.desc())
    )
    latest_template = latest.scalar_one_or_none()

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
    db.add(template)
    await db.flush()
    return template


async def update_report_template(
    db: AsyncSession, template_id: int, template_data: ReportTemplateUpdate
) -> ReportTemplate:
    """Обновить шаблон отчёта."""
    template = await get_report_template_by_id(db, template_id)
    if not template:
        raise NotFoundError("Шаблон отчёта не найден")

    update_data = template_data.model_dump(exclude_unset=True)

    # Если обновляется файл, создаем новую версию
    if "file" in update_data and update_data["file"]:
        # Помечаем старую версию как удаленную
        template.soft_delete()
        await db.flush()

        # Получаем последнюю версию для этого типа отчёта
        latest = await db.execute(
            select(ReportTemplate)
            .where(
                ReportTemplate.report_type == template.report_type,
                ReportTemplate.laboratory_id == template.laboratory_id,
                ReportTemplate.department_id == template.department_id,
                ReportTemplate.deleted_at.is_(None),
            )
            .order_by(ReportTemplate.version.desc())
        )
        latest_template = latest.scalar_one_or_none()

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

        # Создаем новую версию шаблона
        new_template = ReportTemplate(
            report_type=update_data.get("report_type", template.report_type),
            version=next_version,
            file=update_data["file"],
            file_name=update_data.get("file_name", template.file_name),
            laboratory_id=template.laboratory_id,
            department_id=template.department_id,
        )
        db.add(new_template)
        await db.flush()
        return new_template
    else:
        # Если файл не обновляется, просто обновляем другие поля
        for key, value in update_data.items():
            if key != "file":
                setattr(template, key, value)

        await db.flush()
        return template


async def delete_report_template(db: AsyncSession, template_id: int) -> None:
    """Удалить шаблон отчёта (мягкое удаление)."""
    template = await get_report_template_by_id(db, template_id)
    if not template:
        raise NotFoundError("Шаблон отчёта не найден")

    template.soft_delete()
    await db.flush()
