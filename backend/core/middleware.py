from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from core.config import settings
from core.logger import logger


class LogHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        """Логирование заголовков HTTP запросов при включенной настройке LOG_HEADERS."""
        if settings.LOG_HEADERS:
            logger.info(f"Headers: {dict(request.headers)}")
        response = await call_next(request)
        return response
