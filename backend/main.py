from __future__ import annotations
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any, cast
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError, ResponseValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from api import api_router
from core.config import settings
from core.exception_handlers import (
    business_logic_exception_handler,
    response_validation_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from core.exceptions import BusinessLogicError
from core.http_clients import close_all_clients, init_hr_client
from core.middleware import LogHeadersMiddleware
from core.responses import ORJSONResponse
from core.swagger import setup_swagger_ui
from self_check import assert_all_self_checks


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Запустить и остановить приложение."""
    assert_all_self_checks()
    init_hr_client()
    yield
    await close_all_clients()


app = FastAPI(
    title="Laborant API",
    description="API системы Laborant с аутентификацией Keycloak",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url="/api/openapi.json",
    default_response_class=ORJSONResponse,
)


def custom_openapi() -> dict[str, Any]:
    """Закэшировать OpenAPI-схему и зафиксировать версию 3.0.2 для локального Swagger UI."""
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    openapi_schema["openapi"] = "3.0.2"
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi

app.add_middleware(LogHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
    expose_headers=["Content-Disposition", "X-Export-Total"],
)

app.include_router(api_router)

setup_swagger_ui(app)

app.add_exception_handler(RequestValidationError, cast(Any, validation_exception_handler))
app.add_exception_handler(ResponseValidationError, cast(Any, response_validation_exception_handler))
app.add_exception_handler(BusinessLogicError, cast(Any, business_logic_exception_handler))
app.add_exception_handler(Exception, cast(Any, unhandled_exception_handler))
