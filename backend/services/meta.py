from __future__ import annotations
from typing import Any, Protocol
from starlette.routing import BaseRoute
from schemas.meta import ApiEndpointItem, ApiIndexResponse


class ApplicationWithRoutes(Protocol):
    """ASGI-приложение со списком маршрутов."""

    routes: list[Any]


def build_api_index(app: ApplicationWithRoutes) -> ApiIndexResponse:
    """Собрать перечень зарегистрированных API-эндпоинтов."""
    endpoints: list[ApiEndpointItem] = []
    for route in app.routes:
        if not isinstance(route, BaseRoute):
            continue
        path = getattr(route, "path", None)
        methods = getattr(route, "methods", None)
        if path is None or methods is None:
            continue
        if path.startswith("/api"):
            for method in methods:
                if method != "HEAD":
                    endpoints.append(ApiEndpointItem(method=method, path=path))
    sorted_endpoints = sorted(endpoints, key=lambda item: (item.path, item.method))
    return ApiIndexResponse(
        endpoints=sorted_endpoints,
        total=len(sorted_endpoints),
    )
