from __future__ import annotations
from starlette.requests import Request
from starlette.types import ASGIApp, Receive, Scope, Send
from core.config import settings
from core.logger import logger

_SENSITIVE_HEADERS = frozenset({"authorization", "cookie", "set-cookie", "proxy-authorization", "x-api-key"})


def _headers_for_log(request: Request) -> dict[str, str]:
    """Копия заголовков без секретов (токены и cookie маскируются)."""
    return {name: ("***" if name.lower() in _SENSITIVE_HEADERS else value) for name, value in request.headers.items()}


class LogHeadersMiddleware:
    """Логировать HTTP-заголовки, если включён LOG_HEADERS."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and settings.LOG_HEADERS:
            request = Request(scope, receive)
            logger.info("Headers: {}", _headers_for_log(request))
        await self.app(scope, receive, send)
