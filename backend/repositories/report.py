from __future__ import annotations
from typing import List, Optional
from sqlalchemy import desc, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.report import ReportTemplate
from repositories.base import (
    add_and_flush,
    execute_scalar_one_or_none,
    execute_scalars_all,
    filter_not_deleted,
)
from utils.pagination import apply_pagination, get_total_count
from utils.sorting import build_order_by

_REPORT_TEMPLATE_VERSION_NUM = text(
    "CAST(REGEXP_REPLACE(REGEXP_REPLACE(version, '^[vV]', ''), '[^0-9]', '', 'g') AS INTEGER)"
)


def _order_report_templates_by_version_desc(query):
    """Сортировка версий v1, v2, …, v10 по числу, а не как строк."""
    return query.order_by(
        desc(_REPORT_TEMPLATE_VERSION_NUM), ReportTemplate.created_at.desc()
    )


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
        query = filter_not_deleted(query, ReportTemplate.deleted_at)
    return await execute_scalar_one_or_none(db, query)


async def get_latest_report_template(
    db: AsyncSession,
    *,
    laboratory_id: int,
    report_type: str,
    department_id: Optional[int] = None,
) -> Optional[ReportTemplate]:
    """Последняя неудалённая версия шаблона для лаборатории и подразделения."""
    conditions = [
        ReportTemplate.laboratory_id == laboratory_id,
        ReportTemplate.report_type == report_type,
        ReportTemplate.deleted_at.is_(None),
    ]
    if department_id is not None:
        conditions.append(ReportTemplate.department_id == department_id)
    else:
        conditions.append(ReportTemplate.department_id.is_(None))

    query = _order_report_templates_by_version_desc(
        select(ReportTemplate)
        .where(*conditions)
        .options(
            selectinload(ReportTemplate.laboratory),
            selectinload(ReportTemplate.department),
        )
    ).limit(1)
    return await execute_scalar_one_or_none(db, query)


async def get_report_templates(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
    include_deleted: bool = False,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[List[ReportTemplate], int]:
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

    if not sort_by or sort_by == "version":
        query = _order_report_templates_by_version_desc(query)
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
        query = apply_pagination(query, page, page_size)

    templates = await execute_scalars_all(db, query)
    return templates, total


async def get_latest_report_template_for_type(
    db: AsyncSession,
    report_type: str,
    laboratory_id: int,
    department_id: Optional[int],
) -> Optional[ReportTemplate]:
    """Получить последнюю версию шаблона отчёта по типу."""
    query = _order_report_templates_by_version_desc(
        select(ReportTemplate).where(
            ReportTemplate.report_type == report_type,
            ReportTemplate.laboratory_id == laboratory_id,
            ReportTemplate.department_id == department_id,
            ReportTemplate.deleted_at.is_(None),
        )
    ).limit(1)
    return await execute_scalar_one_or_none(db, query)


async def add_report_template(
    db: AsyncSession, template: ReportTemplate
) -> ReportTemplate:
    """Добавить шаблон отчёта в сессию."""
    await add_and_flush(db, template)
    return template
