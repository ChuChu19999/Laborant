from __future__ import annotations
import pendulum
from pendulum.parsing.exceptions import ParserError
from sqlalchemy import ColumnElement, desc, false, func, or_, select, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import bindparam
from models.protocol import Protocol, ProtocolTemplate
from repositories.base import (
    add_and_flush,
    execute_exists,
    execute_scalar_one_or_none,
    execute_scalars_all,
    filter_not_deleted,
    filter_not_deleted_unless,
)
from utils.filters import add_date_range_filter
from utils.pagination import apply_pagination, get_total_count
from utils.protocol.search_filter import protocol_list_row_matches_display_ilike
from utils.protocol.sort import (
    protocol_row_sort_combined,
    protocols_list_samples_registration_sort_subquery,
    sampling_act_number_sort_expression,
)
from utils.sorting import build_order_by


def _build_protocol_conditions(
    *,
    laboratory_id: int | None,
    department_id: int | None,
    is_accredited: bool | None,
    search: str | None,
    search_date: str | None,
    search_sampling_act: str | None,
    sample_ids_for_search: list[int] | None,
    no_sample_match: bool,
    test_protocol_date_from: pendulum.DateTime | None,
    test_protocol_date_to: pendulum.DateTime | None,
    created_at_from: pendulum.DateTime | None,
    created_at_to: pendulum.DateTime | None,
) -> list[ColumnElement[bool]]:
    """Собрать условия фильтрации протоколов."""
    conditions: list[ColumnElement[bool]] = []
    if laboratory_id:
        conditions.append(Protocol.laboratory_id == laboratory_id)
    if department_id:
        conditions.append(Protocol.department_id == department_id)
    if is_accredited is not None:
        conditions.append(Protocol.is_accredited == is_accredited)

    if search and search_date:
        if search.strip():
            conditions.append(protocol_list_row_matches_display_ilike(search))
        try:
            search_date_parsed = pendulum.parse(search_date)
            if isinstance(search_date_parsed, pendulum.DateTime):
                conditions.append(func.date(Protocol.test_protocol_date) == search_date_parsed.date())
        except ParserError:
            pass
    elif search and search.strip():
        conditions.append(protocol_list_row_matches_display_ilike(search))
    elif search_date:
        try:
            search_date_parsed = pendulum.parse(search_date)
            if isinstance(search_date_parsed, pendulum.DateTime):
                conditions.append(func.date(Protocol.test_protocol_date) == search_date_parsed.date())
        except ParserError:
            pass

    if search_sampling_act:
        conditions.append(Protocol.sampling_act_number.ilike(f"%{search_sampling_act}%"))

    if no_sample_match:
        conditions.append(false())
    elif sample_ids_for_search:
        sample_conditions = []
        for sample_id in sample_ids_for_search:
            sample_conditions.append(func.cast(Protocol.samples, JSONB).contains([sample_id]))
        if sample_conditions:
            conditions.append(or_(*sample_conditions))

    add_date_range_filter(
        conditions,
        test_protocol_date_from,
        test_protocol_date_to,
        Protocol.test_protocol_date,
    )
    add_date_range_filter(conditions, created_at_from, created_at_to, Protocol.created_at)
    return conditions


def _build_protocol_template_conditions(
    *,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> list[ColumnElement[bool]]:
    """Собрать условия фильтрации шаблонов протоколов."""
    conditions: list[ColumnElement[bool]] = []
    if laboratory_id:
        conditions.append(ProtocolTemplate.laboratory_id == laboratory_id)
    if department_id:
        conditions.append(ProtocolTemplate.department_id == department_id)
    return conditions


async def get_protocol_by_id(db: AsyncSession, protocol_id: int, include_deleted: bool = False) -> Protocol | None:
    """Получить протокол по ID."""
    query = (
        select(Protocol)
        .where(Protocol.id == protocol_id)
        .options(
            selectinload(Protocol.laboratory),
            selectinload(Protocol.department),
            selectinload(Protocol.protocol_template),
        )
    )
    query = filter_not_deleted_unless(query, Protocol.deleted_at, include_deleted)
    return await execute_scalar_one_or_none(db, query)


async def get_protocols(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    include_deleted: bool = False,
    page: int | None = None,
    page_size: int | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
    is_accredited: bool | None = None,
    search: str | None = None,
    search_date: str | None = None,
    search_sampling_act: str | None = None,
    sample_ids_for_search: list[int] | None = None,
    no_sample_match: bool = False,
    test_protocol_date_from: pendulum.DateTime | None = None,
    test_protocol_date_to: pendulum.DateTime | None = None,
    created_at_from: pendulum.DateTime | None = None,
    created_at_to: pendulum.DateTime | None = None,
) -> tuple[list[Protocol], int]:
    """Получить список протоколов."""
    query = select(Protocol).options(selectinload(Protocol.laboratory), selectinload(Protocol.department))

    query = filter_not_deleted_unless(query, Protocol.deleted_at, include_deleted)

    conditions = _build_protocol_conditions(
        laboratory_id=laboratory_id,
        department_id=department_id,
        is_accredited=is_accredited,
        search=search,
        search_date=search_date,
        search_sampling_act=search_sampling_act,
        sample_ids_for_search=sample_ids_for_search,
        no_sample_match=no_sample_match,
        test_protocol_date_from=test_protocol_date_from,
        test_protocol_date_to=test_protocol_date_to,
        created_at_from=created_at_from,
        created_at_to=created_at_to,
    )

    if conditions:
        query = query.where(*conditions)

    if sort_by == "test_protocol_number":
        sort_expr = protocol_row_sort_combined()
        if sort_order == "asc":
            query = query.order_by(sort_expr.asc(), Protocol.id.asc())
        else:
            query = query.order_by(sort_expr.desc(), Protocol.id.desc())
    elif sort_by == "samples_data":
        samples_sort = protocols_list_samples_registration_sort_subquery()
        if sort_order == "asc":
            query = query.order_by(samples_sort.asc().nulls_last(), Protocol.id.asc())
        else:
            query = query.order_by(samples_sort.desc().nulls_first(), Protocol.id.desc())
    elif sort_by == "sampling_act_number":
        act_sort = sampling_act_number_sort_expression()
        if sort_order == "asc":
            query = query.order_by(act_sort.asc(), Protocol.id.asc())
        else:
            query = query.order_by(act_sort.desc(), Protocol.id.desc())
    else:
        sort_mapping = {
            "id": Protocol.id,
            "test_protocol_date": Protocol.test_protocol_date,
            "is_accredited": Protocol.is_accredited,
            "created_at": Protocol.created_at,
        }
        order_by = build_order_by(sort_by, sort_order, sort_mapping, Protocol.created_at)
        query = query.order_by(order_by)

    count_query = select(func.count()).select_from(Protocol)
    count_query = filter_not_deleted_unless(count_query, Protocol.deleted_at, include_deleted)
    if conditions:
        count_query = count_query.where(*conditions)

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        query = apply_pagination(query, page, page_size)

    protocols = await execute_scalars_all(db, query)
    return protocols, total


async def exists_protocol_by_sampling_act(
    db: AsyncSession,
    sampling_act_number: str,
    exclude_id: int | None = None,
) -> bool:
    """Проверить существование протокола с таким номером акта отбора."""
    query = filter_not_deleted(
        select(Protocol.id).where(Protocol.sampling_act_number == sampling_act_number),
        Protocol.deleted_at,
    )
    if exclude_id is not None:
        query = query.where(Protocol.id != exclude_id)
    return await execute_exists(db, query)


async def add_protocol(db: AsyncSession, protocol: Protocol) -> Protocol:
    """Добавить протокол."""
    await add_and_flush(db, protocol)
    return protocol


async def get_protocol_template_by_id(
    db: AsyncSession, template_id: int, include_deleted: bool = False
) -> ProtocolTemplate | None:
    """Получить шаблон протокола по ID."""
    query = (
        select(ProtocolTemplate)
        .where(ProtocolTemplate.id == template_id)
        .options(
            selectinload(ProtocolTemplate.laboratory),
            selectinload(ProtocolTemplate.department),
        )
    )
    query = filter_not_deleted_unless(query, ProtocolTemplate.deleted_at, include_deleted)
    return await execute_scalar_one_or_none(db, query)


async def get_protocol_templates(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    include_deleted: bool = False,
    page: int | None = None,
    page_size: int | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[ProtocolTemplate], int]:
    """Получить список шаблонов протоколов."""
    query = select(ProtocolTemplate).options(
        selectinload(ProtocolTemplate.laboratory),
        selectinload(ProtocolTemplate.department),
    )

    query = filter_not_deleted_unless(query, ProtocolTemplate.deleted_at, include_deleted)

    conditions = _build_protocol_template_conditions(
        laboratory_id=laboratory_id,
        department_id=department_id,
    )
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "name": ProtocolTemplate.name,
        "version": ProtocolTemplate.version,
        "created_at": ProtocolTemplate.created_at,
    }

    if not sort_by:
        version_num_expr = text(
            "CAST(REGEXP_REPLACE(REGEXP_REPLACE(version, '^[vV]', ''), '[^0-9]', '', 'g') AS INTEGER)"
        )
        query = query.order_by(desc(version_num_expr), ProtocolTemplate.created_at.desc())
    else:
        order_by = build_order_by(sort_by, sort_order, sort_mapping, ProtocolTemplate.created_at)
        query = query.order_by(order_by)

    count_query = select(func.count()).select_from(ProtocolTemplate)
    count_query = filter_not_deleted_unless(count_query, ProtocolTemplate.deleted_at, include_deleted)
    if conditions:
        count_query = count_query.where(*conditions)

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        query = apply_pagination(query, page, page_size)

    templates = await execute_scalars_all(db, query)
    return templates, total


async def get_latest_protocol_template(
    db: AsyncSession,
    name: str,
    laboratory_id: int,
    department_id: int | None,
) -> ProtocolTemplate | None:
    """Получить последнюю версию шаблона протокола."""
    query = filter_not_deleted(
        select(ProtocolTemplate).where(
            ProtocolTemplate.name == name,
            ProtocolTemplate.laboratory_id == laboratory_id,
            ProtocolTemplate.department_id == department_id,
        ),
        ProtocolTemplate.deleted_at,
    )
    query = query.order_by(ProtocolTemplate.version.desc()).limit(1)
    return await execute_scalar_one_or_none(db, query)


async def add_protocol_template(db: AsyncSession, template: ProtocolTemplate) -> ProtocolTemplate:
    """Добавить шаблон протокола."""
    await add_and_flush(db, template)
    return template


async def get_protocols_by_sample_ids(db: AsyncSession, sample_ids: list[int]) -> list[Protocol]:
    """Получить протоколы для списка ID проб."""
    if not sample_ids:
        return []

    query = filter_not_deleted(
        select(Protocol).where(
            text(
                "EXISTS (SELECT 1 FROM jsonb_array_elements_text(samples::jsonb) AS elem WHERE elem::int = ANY(:sample_ids))"
            ).bindparams(bindparam("sample_ids")),
        ),
        Protocol.deleted_at,
    )
    result = await db.execute(query, {"sample_ids": sample_ids})
    return list(result.scalars().all())
