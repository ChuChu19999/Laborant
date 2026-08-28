from __future__ import annotations
from sqlalchemy import ColumnElement, Select, desc, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.report import ReportTemplate
from repositories.base import (
    add_and_flush,
    execute_scalar_one_or_none,
    execute_scalars_all,
    filter_not_deleted,
    filter_not_deleted_unless,
)
from utils.pagination import apply_pagination, get_total_count
from utils.sorting import build_order_by

_REPORT_TEMPLATE_VERSION_NUM = text(
    "CAST(REGEXP_REPLACE(REGEXP_REPLACE(version, '^[vV]', ''), '[^0-9]', '', 'g') AS INTEGER)"
)


def _build_report_template_conditions(
    *,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> list[ColumnElement[bool]]:
    """Собрать условия фильтрации шаблонов отчётов."""
    conditions: list[ColumnElement[bool]] = []
    if laboratory_id:
        conditions.append(ReportTemplate.laboratory_id == laboratory_id)
    if department_id:
        conditions.append(ReportTemplate.department_id == department_id)
    return conditions


def _order_report_templates_by_version_desc(query: Select[tuple[ReportTemplate]]) -> Select[tuple[ReportTemplate]]:
    """Сортировка версий v1, v2, …, v10 по числу, а не как строк."""
    return query.order_by(desc(_REPORT_TEMPLATE_VERSION_NUM), ReportTemplate.created_at.desc())


async def get_report_template_by_id(
    db: AsyncSession, template_id: int, include_deleted: bool = False
) -> ReportTemplate | None:
    """Получить шаблон отчёта по ID."""
    query = (
        select(ReportTemplate)
        .where(ReportTemplate.id == template_id)
        .options(
            selectinload(ReportTemplate.laboratory),
            selectinload(ReportTemplate.department),
        )
    )
    query = filter_not_deleted_unless(query, ReportTemplate.deleted_at, include_deleted)
    return await execute_scalar_one_or_none(db, query)


async def get_latest_report_template(
    db: AsyncSession,
    *,
    laboratory_id: int,
    report_type: str,
    department_id: int | None = None,
) -> ReportTemplate | None:
    """Получить последнюю неудалённую версию шаблона для лаборатории и подразделения."""
    query = filter_not_deleted(
        select(ReportTemplate).where(
            ReportTemplate.laboratory_id == laboratory_id,
            ReportTemplate.report_type == report_type,
        ),
        ReportTemplate.deleted_at,
    )
    if department_id is not None:
        query = query.where(ReportTemplate.department_id == department_id)
    else:
        query = query.where(ReportTemplate.department_id.is_(None))

    query = _order_report_templates_by_version_desc(
        query.options(
            selectinload(ReportTemplate.laboratory),
            selectinload(ReportTemplate.department),
        )
    ).limit(1)
    return await execute_scalar_one_or_none(db, query)


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
    query = select(ReportTemplate).options(
        selectinload(ReportTemplate.laboratory),
        selectinload(ReportTemplate.department),
    )

    query = filter_not_deleted_unless(query, ReportTemplate.deleted_at, include_deleted)

    conditions = _build_report_template_conditions(
        laboratory_id=laboratory_id,
        department_id=department_id,
    )
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "report_type": ReportTemplate.report_type,
        "version": ReportTemplate.version,
        "created_at": ReportTemplate.created_at,
    }

    if not sort_by or sort_by == "version":
        query = _order_report_templates_by_version_desc(query)
    else:
        order_by = build_order_by(sort_by, sort_order, sort_mapping, ReportTemplate.created_at)
        query = query.order_by(order_by)

    count_query = select(func.count()).select_from(ReportTemplate)
    count_query = filter_not_deleted_unless(count_query, ReportTemplate.deleted_at, include_deleted)
    if conditions:
        count_query = count_query.where(*conditions)

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        query = apply_pagination(query, page, page_size)

    templates = await execute_scalars_all(db, query)
    return templates, total


async def add_report_template(db: AsyncSession, template: ReportTemplate) -> ReportTemplate:
    """Добавить шаблон отчёта."""
    await add_and_flush(db, template)
    return template
