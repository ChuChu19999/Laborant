from __future__ import annotations
import traceback
import pendulum
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import run_isolated_transaction
from core.exceptions import DomainValidationError, ForbiddenError, NotFoundError
from core.logger import logger
from models.monitoring_error import MonitoringError
from models.user_presence import PresenceCategory, UserPresence
from repositories import monitoring as monitoring_repo
from schemas.monitoring import (
    ClientErrorReportCreate,
    HeartbeatCreate,
    MonitoringCleanupResponse,
    MonitoringMessageResponse,
    MonitoringOptionResponse,
    MonitoringOverviewResponse,
    MonitoringPeriod,
    OnlineUserResponse,
    PresenceStatsResponse,
)
from services.user_permissions import resolve_user_permissions
from utils.app_version import get_app_version
from utils.database_health import measure_database_health
from utils.monitoring_error_format import (
    compute_error_fingerprint,
    normalize_path,
    prepare_error_payload,
)
from utils.monitoring_labels import (
    HEALTH_STATUS_OPTIONS,
    MONITORING_PERIOD_OPTIONS,
    MONITORING_RESOLVED_OPTIONS,
    MONITORING_SEVERITY_OPTIONS,
    MONITORING_SOURCE_OPTIONS,
    PRESENCE_CATEGORY_OPTIONS,
)
from utils.monitoring_period import (
    DEFAULT_MONITORING_PERIOD,
    MONITORING_CLEANUP_RESOLVED_DAYS,
    resolve_monitoring_period_since,
)

PRESENCE_ONLINE_SECONDS = 120

MonitoringSeverityValue = str
MonitoringSourceValue = str


def _build_monitoring_options(options: tuple[tuple[str, str], ...]) -> list[MonitoringOptionResponse]:
    """Собрать список value/label для UI мониторинга."""
    return [MonitoringOptionResponse(value=value, label=label) for value, label in options]


_MONITORING_RECORD_ERRORS = (
    AttributeError,
    OSError,
    RuntimeError,
    SQLAlchemyError,
    TypeError,
    ValueError,
)


def resolve_presence_category(
    *,
    is_admin: bool,
    role_types: list[str],
) -> str:
    """Определить категорию присутствия: laborant → engineer → admin."""
    if "laborant" in role_types:
        return PresenceCategory.LABORANT.value
    if "engineer" in role_types:
        return PresenceCategory.ENGINEER.value
    if is_admin:
        return PresenceCategory.ADMIN.value
    raise DomainValidationError("Не удалось определить категорию присутствия пользователя")


async def require_monitoring_error_by_id(db: AsyncSession, error_id: int) -> MonitoringError:
    """Получить ошибку мониторинга по ID или выбросить NotFoundError."""
    error = await monitoring_repo.get_monitoring_error_by_id(db, error_id)
    if error is None:
        raise NotFoundError(f"Ошибка мониторинга с ID {error_id} не найдена")
    return error


async def record_monitoring_error(
    db: AsyncSession,
    *,
    source: MonitoringSourceValue,
    severity: MonitoringSeverityValue,
    message: str,
    stack_trace: str | None = None,
    path: str | None = None,
    exception_type: str | None = None,
    reporter_name: str | None = None,
    reporter_hash: str | None = None,
    user_agent: str | None = None,
    app_version: str | None = None,
) -> None:
    """Записать уникальную ошибку или обновить счётчик повторов; закрытую снова открыть."""
    trimmed_message, trimmed_stack, summary, top_frame = prepare_error_payload(
        message=message,
        stack_trace=stack_trace,
        path=path,
    )
    normalized_path = normalize_path(path)
    fingerprint = compute_error_fingerprint(
        source=source,
        severity=severity,
        message=message,
        path=path,
        top_frame=top_frame,
    )
    now = pendulum.now("UTC")

    existing = await monitoring_repo.get_monitoring_error_by_fingerprint(db, fingerprint)
    if existing is not None:
        existing.occurrence_count += 1
        existing.updated_at = now
        if existing.resolved_at is not None:
            existing.resolved_at = None
            existing.resolved_by_name = None
            existing.resolved_by_hash = None
            existing.resolve_comment = None
        if reporter_name:
            existing.reporter_name = reporter_name
        if reporter_hash:
            existing.reporter_hash = reporter_hash
        if user_agent:
            existing.user_agent = user_agent
        if app_version:
            existing.app_version = app_version
        await monitoring_repo.flush_monitoring_error(db)
        return

    error = MonitoringError(
        fingerprint=fingerprint,
        severity=severity,
        source=source,
        message=trimmed_message,
        summary=summary,
        stack_trace=trimmed_stack,
        path=normalized_path,
        exception_type=exception_type,
        occurrence_count=1,
        reporter_name=reporter_name,
        reporter_hash=reporter_hash,
        user_agent=user_agent,
        app_version=app_version,
    )
    await monitoring_repo.add_monitoring_error(db, error)


async def record_monitoring_error_safe(
    *,
    source: MonitoringSourceValue,
    severity: MonitoringSeverityValue,
    message: str,
    stack_trace: str | None = None,
    path: str | None = None,
    exception_type: str | None = None,
) -> None:
    """Записать ошибку мониторинга в отдельной транзакции без влияния на HTTP-запрос."""
    try:

        async def _record(db: AsyncSession) -> None:
            await record_monitoring_error(
                db,
                source=source,
                severity=severity,
                message=message,
                stack_trace=stack_trace,
                path=path,
                exception_type=exception_type,
                app_version=get_app_version(),
            )

        await run_isolated_transaction(_record)
    except _MONITORING_RECORD_ERRORS:
        logger.exception("Не удалось записать событие мониторинга")


async def record_unhandled_backend_error(
    path: str,
    exc: BaseException,
    severity: MonitoringSeverityValue = "error",
) -> None:
    """Записать необработанное исключение бэкенда."""
    stack_trace = traceback.format_exc()
    await record_monitoring_error_safe(
        source="backend",
        severity=severity,
        message=str(exc) or type(exc).__name__,
        stack_trace=stack_trace,
        path=path,
        exception_type=type(exc).__name__,
    )


async def touch_user_presence(
    db: AsyncSession,
    *,
    hsnils: str,
    full_name: str,
    is_admin: bool,
    role_types: list[str],
    current_path: str | None = None,
) -> None:
    """Обновить heartbeat пользователя."""
    if not hsnils:
        return

    category = resolve_presence_category(is_admin=is_admin, role_types=role_types)
    presence = UserPresence(
        hsnils=hsnils,
        full_name=full_name or "",
        presence_category=category,
        last_seen_at=pendulum.now("UTC"),
        current_path=normalize_path(current_path) if current_path else None,
    )
    await monitoring_repo.upsert_user_presence(db, presence)


async def get_presence_stats(db: AsyncSession) -> PresenceStatsResponse:
    """Собрать счётчики и список онлайн-пользователей."""
    since = pendulum.now("UTC").subtract(seconds=PRESENCE_ONLINE_SECONDS)
    online_users = await monitoring_repo.get_online_presence_since(db, since)

    laborant = 0
    engineer = 0
    admin = 0
    for user in online_users:
        if user.presence_category == PresenceCategory.LABORANT.value:
            laborant += 1
        elif user.presence_category == PresenceCategory.ENGINEER.value:
            engineer += 1
        elif user.presence_category == PresenceCategory.ADMIN.value:
            admin += 1

    online_user_items = [OnlineUserResponse.model_validate(user) for user in online_users]

    return PresenceStatsResponse(
        total=len(online_users),
        laborant=laborant,
        engineer=engineer,
        admin=admin,
        online_users=online_user_items,
    )


async def get_monitoring_overview(
    db: AsyncSession,
    *,
    period: MonitoringPeriod = DEFAULT_MONITORING_PERIOD,
) -> MonitoringOverviewResponse:
    """Собрать сводку для страницы мониторинга."""
    since = resolve_monitoring_period_since(period)
    new_errors_count = await monitoring_repo.count_new_monitoring_errors_since(db, since)
    presence = await get_presence_stats(db)
    health_status, db_latency_ms = await measure_database_health(db)
    period_options = _build_monitoring_options(MONITORING_PERIOD_OPTIONS)
    return MonitoringOverviewResponse(
        health_status=health_status,
        db_latency_ms=db_latency_ms,
        app_version=get_app_version(),
        period=period,
        default_period=DEFAULT_MONITORING_PERIOD,
        period_options=period_options,
        severity_options=_build_monitoring_options(MONITORING_SEVERITY_OPTIONS),
        source_options=_build_monitoring_options(MONITORING_SOURCE_OPTIONS),
        resolved_options=_build_monitoring_options(MONITORING_RESOLVED_OPTIONS),
        health_options=_build_monitoring_options(HEALTH_STATUS_OPTIONS),
        presence_options=_build_monitoring_options(PRESENCE_CATEGORY_OPTIONS),
        new_errors_count=new_errors_count,
        presence=presence,
    )


async def get_monitoring_errors_list(
    db: AsyncSession,
    *,
    severity: str | None = None,
    source: str | None = None,
    resolved: bool | None = None,
    search: str | None = None,
    occurrence_count: int | None = None,
    app_version: str | None = None,
    last_seen: str | None = None,
    period: MonitoringPeriod = DEFAULT_MONITORING_PERIOD,
    sort_by: str | None = None,
    sort_order: str | None = None,
    page: int | None = None,
    page_size: int | None = None,
) -> tuple[list[MonitoringError], int]:
    """Получить список ошибок мониторинга."""
    last_seen_from = resolve_monitoring_period_since(period)
    return await monitoring_repo.get_monitoring_errors(
        db,
        severity=severity,
        source=source,
        resolved=resolved,
        search=search,
        occurrence_count=occurrence_count,
        app_version=app_version,
        last_seen=last_seen,
        last_seen_from=last_seen_from,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )


async def update_monitoring_error_status(
    db: AsyncSession,
    error_id: int,
    *,
    resolved: bool,
    comment: str | None = None,
    resolver_name: str | None = None,
    resolver_hash: str | None = None,
) -> MonitoringMessageResponse:
    """Изменить статус ошибки мониторинга: открыта или закрыта."""
    error = await require_monitoring_error_by_id(db, error_id)

    now = pendulum.now("UTC")
    if resolved:
        error.resolved_at = now
        error.resolved_by_name = resolver_name
        error.resolved_by_hash = resolver_hash
        trimmed_comment = comment.strip() if comment else None
        error.resolve_comment = trimmed_comment or None
    else:
        error.resolved_at = None
        trimmed_comment = comment.strip() if comment else None
        if trimmed_comment:
            if error.resolve_comment:
                error.resolve_comment = f"{error.resolve_comment}\nОткрыто снова: {trimmed_comment}"
            else:
                error.resolve_comment = trimmed_comment
    error.updated_at = now
    await monitoring_repo.flush_monitoring_error(db)
    if resolved:
        return MonitoringMessageResponse(message="Ошибка отмечена как решённая")
    return MonitoringMessageResponse(message="Ошибка снова открыта")


async def cleanup_closed_monitoring_errors(db: AsyncSession) -> MonitoringCleanupResponse:
    """Удалить закрытые ошибки старше 90 дней."""
    before = pendulum.now("UTC").subtract(days=MONITORING_CLEANUP_RESOLVED_DAYS)
    deleted_count = await monitoring_repo.delete_resolved_monitoring_errors_before(db, before)
    if deleted_count == 0:
        return MonitoringCleanupResponse(
            message="Нет закрытых ошибок старше 90 дней",
            deleted_count=0,
        )
    return MonitoringCleanupResponse(
        message=f"Удалено закрытых ошибок: {deleted_count}",
        deleted_count=deleted_count,
    )


async def record_client_error(
    db: AsyncSession,
    payload: ClientErrorReportCreate,
    *,
    reporter_name: str | None = None,
    reporter_hash: str | None = None,
) -> MonitoringMessageResponse:
    """Записать ошибку, присланную с фронтенда."""
    trimmed_user_agent = payload.user_agent.strip() if payload.user_agent else None
    trimmed_client_version = payload.client_version.strip() if payload.client_version else None
    await record_monitoring_error(
        db,
        source="frontend",
        severity=payload.severity,
        message=payload.message,
        stack_trace=payload.stack_trace,
        path=payload.url,
        reporter_name=reporter_name,
        reporter_hash=reporter_hash,
        user_agent=trimmed_user_agent,
        app_version=trimmed_client_version,
    )
    return MonitoringMessageResponse(message="Ошибка записана")


async def record_heartbeat(
    db: AsyncSession,
    decoded_token: dict,
    payload: HeartbeatCreate | None = None,
) -> MonitoringMessageResponse:
    """Обновить heartbeat присутствия текущего пользователя."""
    permissions = await resolve_user_permissions(db, decoded_token)
    if not permissions["access_granted"]:
        raise ForbiddenError("Отказано в доступе")

    current_path = payload.current_path if payload else None
    await touch_user_presence(
        db,
        hsnils=decoded_token.get("hashSnils") or "",
        full_name=decoded_token.get("fullName") or "",
        is_admin=permissions["is_admin"],
        role_types=permissions["role_types"],
        current_path=current_path,
    )
    return MonitoringMessageResponse(message="Heartbeat обновлён")
