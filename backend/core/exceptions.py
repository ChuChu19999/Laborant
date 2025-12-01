from fastapi import HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from core.logger import logger
from core.responses import ORJSONResponse


class BusinessLogicError(Exception):
    """Базовое исключение для ошибок бизнес-логики."""

    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class NotFoundError(BusinessLogicError):
    """Исключение для случаев, когда ресурс не найден."""

    def __init__(self, message: str):
        super().__init__(message, status_code=status.HTTP_404_NOT_FOUND)


class ValidationError(BusinessLogicError):
    """Исключение для ошибок валидации данных."""

    def __init__(self, message: str):
        super().__init__(message, status_code=status.HTTP_400_BAD_REQUEST)


class ConflictError(BusinessLogicError):
    """Исключение для конфликтов (дублирование, нарушение ограничений)."""

    def __init__(self, message: str):
        super().__init__(message, status_code=status.HTTP_409_CONFLICT)


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> ORJSONResponse:
    """Обработчик ошибок валидации с логированием."""
    logger.error(f"Ошибка валидации для {request.url.path}: {exc.errors()}")
    logger.error(
        f"Тело запроса: {await request.body() if hasattr(request, 'body') else 'N/A'}"
    )
    return ORJSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "body": str(exc.body)},
    )


async def business_logic_exception_handler(
    request: Request, exc: BusinessLogicError
) -> ORJSONResponse:
    """Обработчик ошибок бизнес-логики."""
    logger.warning(f"Ошибка бизнес-логики для {request.url.path}: {exc.message}")
    return ORJSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message},
    )
