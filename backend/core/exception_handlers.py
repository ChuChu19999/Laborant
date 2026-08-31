from __future__ import annotations
from collections.abc import Awaitable, Callable
from typing import Any, Literal
from fastapi import Request, status
from fastapi.exceptions import RequestValidationError, ResponseValidationError
from sqlalchemy.exc import SQLAlchemyError
from core.exceptions import (
    BusinessLogicError,
    ConflictError,
    DomainValidationError,
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
)
from core.logger import logger
from core.responses import ORJSONResponse

MonitoringSeverityLiteral = Literal["warning", "error", "critical"]
BackendMonitoringRecorder = Callable[[str, BaseException, MonitoringSeverityLiteral], Awaitable[None]]

_backend_monitoring_recorder: BackendMonitoringRecorder | None = None

_BUSINESS_STATUS_CODES: dict[type[BusinessLogicError], int] = {
    NotFoundError: status.HTTP_404_NOT_FOUND,
    DomainValidationError: status.HTTP_400_BAD_REQUEST,
    ConflictError: status.HTTP_409_CONFLICT,
    ForbiddenError: status.HTTP_403_FORBIDDEN,
    ServiceUnavailableError: status.HTTP_503_SERVICE_UNAVAILABLE,
}


def _json_safe_value(value: Any) -> Any:
    """Привести значение к виду, совместимому с orjson."""
    if isinstance(value, BaseException):
        return _safe_exc_message(value)
    if hasattr(value, "__mapper__"):
        return f"<{type(value).__name__}>"
    if isinstance(value, dict):
        return {key: _json_safe_value(item) for key, item in value.items()}
    if isinstance(value, list | tuple):
        return [_json_safe_value(item) for item in value]
    return value


_SAFE_FALLBACK_ERRORS = (AttributeError, RuntimeError, SQLAlchemyError, TypeError, ValueError)


def register_backend_monitoring_recorder(recorder: BackendMonitoringRecorder) -> None:
    """Зарегистрировать записыватель ошибок мониторинга для exception handlers."""
    global _backend_monitoring_recorder
    _backend_monitoring_recorder = recorder


async def _try_record_backend_monitoring_error(
    path: str,
    exc: BaseException,
    severity: MonitoringSeverityLiteral,
) -> None:
    """Записать ошибку мониторинга, если записыватель зарегистрирован."""
    if _backend_monitoring_recorder is None:
        return
    try:
        await _backend_monitoring_recorder(path, exc, severity)
    except _SAFE_FALLBACK_ERRORS:
        logger.exception("Не удалось записать событие мониторинга")


def _safe_exc_message(exc: BaseException) -> str:
    """Собрать текст исключения без падения на ORM в ResponseValidationError."""
    try:
        return str(exc)
    except _SAFE_FALLBACK_ERRORS:
        return f"{type(exc).__name__} (не удалось сформировать сообщение)"


def _status_for_business_error(exc: BusinessLogicError) -> int:
    """Подобрать HTTP-код по типу доменного исключения."""
    for exc_type, code in _BUSINESS_STATUS_CODES.items():
        if isinstance(exc, exc_type):
            return code
    return status.HTTP_400_BAD_REQUEST


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> ORJSONResponse:
    """Обработать ошибку валидации запроса (422)."""
    logger.warning("Ошибка валидации для {}: {}", request.url.path, exc.errors())
    return ORJSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": _json_safe_value(exc.errors())},
    )


async def response_validation_exception_handler(request: Request, exc: ResponseValidationError) -> ORJSONResponse:
    """Обработать ошибку валидации ответа (не отдавать ORM в лог через str(exc))."""
    try:
        details = _json_safe_value(exc.errors())
    except _SAFE_FALLBACK_ERRORS:
        details = [{"msg": "Response validation failed"}]
    logger.error("Ошибка валидации ответа для {}: {}", request.url.path, details)
    await _try_record_backend_monitoring_error(request.url.path, exc, "critical")
    return ORJSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Внутренняя ошибка сервера"},
    )


async def business_logic_exception_handler(request: Request, exc: BusinessLogicError) -> ORJSONResponse:
    """Обработать ошибку бизнес-логики."""
    logger.warning("Ошибка бизнес-логики для {}: {}", request.url.path, exc.message)
    return ORJSONResponse(
        status_code=_status_for_business_error(exc),
        content={"detail": exc.message},
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> ORJSONResponse:
    """Обработать непредвиденную ошибку."""
    logger.exception("Необработанная ошибка для {}: {}", request.url.path, _safe_exc_message(exc))
    await _try_record_backend_monitoring_error(request.url.path, exc, "error")
    return ORJSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Внутренняя ошибка сервера"},
    )
