from __future__ import annotations
from fastapi import APIRouter, status
from core.deps import (
    CurrentUser,
    DbSession,
    MonitoringErrorListFiltersDep,
    MonitoringOverviewPeriodDep,
    UserPermissions,
    require_admin,
)
from core.exceptions import ForbiddenError
from schemas.monitoring import (
    ClientErrorReportCreate,
    HeartbeatCreate,
    MonitoringCleanupResponse,
    MonitoringErrorResponse,
    MonitoringErrorStatusUpdate,
    MonitoringMessageResponse,
    MonitoringOverviewResponse,
)
from schemas.pagination import PaginatedResponse, build_paginated_response
from services.monitoring import (
    cleanup_closed_monitoring_errors,
    get_monitoring_errors_list,
    get_monitoring_overview,
    record_client_error,
    record_heartbeat,
    update_monitoring_error_status,
)

router = APIRouter()


@router.get(
    "/monitoring/overview/",
    response_model=MonitoringOverviewResponse,
    summary="Сводка мониторинга",
    description="Возвращает счётчики онлайн, новые ошибки и статус приложения.",
    responses={
        200: {"description": "Сводка успешно получена"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def monitoring_overview(
    db: DbSession,
    effective: UserPermissions,
    overview_period: MonitoringOverviewPeriodDep,
) -> MonitoringOverviewResponse:
    require_admin(effective)
    return await get_monitoring_overview(db, period=overview_period.period)


@router.get(
    "/monitoring/errors/",
    response_model=PaginatedResponse[MonitoringErrorResponse],
    summary="Список ошибок мониторинга",
    description="Возвращает уникальные ошибки с пагинацией и фильтрами.",
    responses={
        200: {"description": "Список ошибок успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def list_monitoring_errors(
    db: DbSession,
    effective: UserPermissions,
    filters: MonitoringErrorListFiltersDep,
):
    require_admin(effective)
    items, total = await get_monitoring_errors_list(
        db,
        severity=filters.severity,
        source=filters.source,
        resolved=filters.resolved,
        search=filters.search,
        occurrence_count=filters.occurrence_count,
        app_version=filters.app_version,
        last_seen=filters.last_seen,
        period=filters.period,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
        page=filters.page,
        page_size=filters.page_size,
    )
    return build_paginated_response(items, total, filters.page, filters.page_size)


@router.post(
    "/monitoring/errors/cleanup-closed/",
    response_model=MonitoringCleanupResponse,
    summary="Очистить закрытые ошибки",
    description="Удаляет закрытые ошибки старше 90 дней.",
    responses={
        200: {"description": "Очистка выполнена"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def cleanup_closed_monitoring_errors_endpoint(
    db: DbSession,
    effective: UserPermissions,
) -> MonitoringCleanupResponse:
    require_admin(effective)
    return await cleanup_closed_monitoring_errors(db)


@router.patch(
    "/monitoring/errors/{error_id:int}/status/",
    response_model=MonitoringMessageResponse,
    summary="Изменить статус ошибки мониторинга",
    description="Отмечает ошибку как решённую или снова открывает её.",
    responses={
        200: {"description": "Статус обновлён"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Ошибка не найдена"},
    },
)
# @IsAuthenticated
async def update_monitoring_error_status_endpoint(
    error_id: int,
    payload: MonitoringErrorStatusUpdate,
    db: DbSession,
    effective: UserPermissions,
    decoded_token: CurrentUser,
) -> MonitoringMessageResponse:
    require_admin(effective)
    return await update_monitoring_error_status(
        db,
        error_id,
        resolved=payload.resolved,
        comment=payload.comment,
        resolver_name=decoded_token.get("fullName") or None,
        resolver_hash=decoded_token.get("hashSnils") or None,
    )


@router.post(
    "/monitoring/client-errors/",
    response_model=MonitoringMessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Репорт ошибки с фронтенда",
    description="Сохраняет уникальную ошибку клиента.",
    responses={
        201: {"description": "Ошибка записана"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def report_client_error(
    payload: ClientErrorReportCreate,
    db: DbSession,
    effective: UserPermissions,
    decoded_token: CurrentUser,
) -> MonitoringMessageResponse:
    if not effective.access_granted:
        raise ForbiddenError("Отказано в доступе")
    return await record_client_error(
        db,
        payload,
        reporter_name=decoded_token.get("fullName") or None,
        reporter_hash=decoded_token.get("hashSnils") or None,
    )


@router.post(
    "/monitoring/presence/heartbeat/",
    response_model=MonitoringMessageResponse,
    summary="Heartbeat присутствия",
    description="Обновляет время последней активности пользователя.",
    responses={
        200: {"description": "Heartbeat обновлён"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def presence_heartbeat(
    db: DbSession,
    decoded_token: CurrentUser,
    payload: HeartbeatCreate | None = None,
) -> MonitoringMessageResponse:
    return await record_heartbeat(db, decoded_token, payload)
