from __future__ import annotations
from datetime import datetime
import pendulum
from sqlalchemy import ColumnElement, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from models.monitoring_error import MonitoringError
from models.user_presence import UserPresence
from repositories.base import (
    add_and_flush,
    execute_scalar_one_or_none,
    execute_scalars_all,
    flush_entity,
)
from utils.filters import add_date_range_filter
from utils.pagination import apply_pagination, get_total_count
from utils.sorting import build_order_by


def _build_error_conditions(
    *,
    severity: str | None = None,
    source: str | None = None,
    resolved: bool | None = None,
    search: str | None = None,
    occurrence_count: int | None = None,
    app_version: str | None = None,
    period_since: datetime | None = None,
    last_seen_at_from: pendulum.DateTime | None = None,
    last_seen_at_to: pendulum.DateTime | None = None,
) -> list[ColumnElement[bool]]:
    """Собрать условия фильтрации ошибок мониторинга."""
    conditions: list[ColumnElement[bool]] = []
    if severity:
        conditions.append(MonitoringError.severity == severity)
    if source:
        conditions.append(MonitoringError.source == source)
    if resolved is True:
        conditions.append(MonitoringError.resolved_at.is_not(None))
    elif resolved is False:
        conditions.append(MonitoringError.resolved_at.is_(None))
    if search:
        pattern = f"%{search}%"
        conditions.append(
            MonitoringError.summary.ilike(pattern)
            | MonitoringError.message.ilike(pattern)
            | MonitoringError.path.ilike(pattern)
        )
    if occurrence_count is not None:
        conditions.append(MonitoringError.occurrence_count == occurrence_count)
    if app_version:
        pattern = f"%{app_version}%"
        conditions.append(MonitoringError.app_version.ilike(pattern))
    if period_since is not None:
        conditions.append(MonitoringError.updated_at >= period_since)
    add_date_range_filter(conditions, last_seen_at_from, last_seen_at_to, MonitoringError.updated_at)
    return conditions


async def get_monitoring_error_by_fingerprint(
    db: AsyncSession,
    fingerprint: str,
) -> MonitoringError | None:
    """Получить ошибку мониторинга по fingerprint."""
    query = select(MonitoringError).where(MonitoringError.fingerprint == fingerprint)
    return await execute_scalar_one_or_none(db, query)


async def get_monitoring_error_by_id(
    db: AsyncSession,
    error_id: int,
) -> MonitoringError | None:
    """Получить ошибку мониторинга по ID."""
    query = select(MonitoringError).where(MonitoringError.id == error_id)
    return await execute_scalar_one_or_none(db, query)


async def add_monitoring_error(
    db: AsyncSession,
    error: MonitoringError,
) -> MonitoringError:
    """Добавить ошибку мониторинга."""
    await add_and_flush(db, error)
    return error


async def flush_monitoring_error(db: AsyncSession) -> None:
    """Сохранить изменения ошибки мониторинга."""
    await flush_entity(db)


async def get_monitoring_errors(
    db: AsyncSession,
    *,
    severity: str | None = None,
    source: str | None = None,
    resolved: bool | None = None,
    search: str | None = None,
    occurrence_count: int | None = None,
    app_version: str | None = None,
    period_since: datetime | None = None,
    last_seen_at_from: pendulum.DateTime | None = None,
    last_seen_at_to: pendulum.DateTime | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
    page: int | None = None,
    page_size: int | None = None,
) -> tuple[list[MonitoringError], int]:
    """Получить список ошибок мониторинга."""
    query = select(MonitoringError)
    conditions = _build_error_conditions(
        severity=severity,
        source=source,
        resolved=resolved,
        search=search,
        occurrence_count=occurrence_count,
        app_version=app_version,
        period_since=period_since,
        last_seen_at_from=last_seen_at_from,
        last_seen_at_to=last_seen_at_to,
    )
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "severity": MonitoringError.severity,
        "source": MonitoringError.source,
        "occurrence_count": MonitoringError.occurrence_count,
        "app_version": MonitoringError.app_version,
        "first_seen_at": MonitoringError.created_at,
        "last_seen_at": MonitoringError.updated_at,
        "resolved_at": MonitoringError.resolved_at,
    }
    order_by = build_order_by(
        sort_by,
        sort_order,
        sort_mapping,
        MonitoringError.updated_at,
        default_order="desc",
    )
    query = query.order_by(order_by)

    count_query = select(func.count()).select_from(MonitoringError)
    if conditions:
        count_query = count_query.where(*conditions)
    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        query = apply_pagination(query, page, page_size)

    items = await execute_scalars_all(db, query)
    return items, total


async def count_new_monitoring_errors_since(
    db: AsyncSession,
    since: datetime | None,
) -> int:
    """Подсчитать ошибки, впервые появившиеся после указанного времени; без since — все."""
    query = select(func.count()).select_from(MonitoringError)
    if since is not None:
        query = query.where(MonitoringError.created_at >= since)
    return await get_total_count(db, query)


async def upsert_user_presence(
    db: AsyncSession,
    presence: UserPresence,
) -> UserPresence:
    """Сохранить или обновить присутствие пользователя."""
    existing = await get_user_presence(db, presence.hsnils)
    if existing is None:
        db.add(presence)
        await flush_entity(db)
        return presence

    existing.full_name = presence.full_name
    existing.presence_category = presence.presence_category
    existing.last_seen_at = presence.last_seen_at
    existing.current_path = presence.current_path
    await flush_entity(db)
    return existing


async def get_user_presence(
    db: AsyncSession,
    hsnils: str,
) -> UserPresence | None:
    """Получить записи присутствия пользователя."""
    query = select(UserPresence).where(UserPresence.hsnils == hsnils)
    return await execute_scalar_one_or_none(db, query)


async def get_online_presence_since(
    db: AsyncSession,
    since: datetime,
) -> list[UserPresence]:
    """Получить пользователей онлайн с указанного момента."""
    query = select(UserPresence).where(UserPresence.last_seen_at >= since).order_by(UserPresence.last_seen_at.desc())
    return await execute_scalars_all(db, query)


async def delete_resolved_monitoring_errors_before(
    db: AsyncSession,
    before: datetime,
) -> int:
    """Удалить закрытые ошибки, закрытые до указанного момента."""
    count_query = (
        select(func.count())
        .select_from(MonitoringError)
        .where(
            MonitoringError.resolved_at.is_not(None),
            MonitoringError.resolved_at < before,
        )
    )
    total = await get_total_count(db, count_query)
    if total == 0:
        return 0

    await db.execute(
        delete(MonitoringError).where(
            MonitoringError.resolved_at.is_not(None),
            MonitoringError.resolved_at < before,
        )
    )
    await flush_entity(db)
    return total
