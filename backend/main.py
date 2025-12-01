from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from core.config import settings
from core.exceptions import (
    BusinessLogicError,
    business_logic_exception_handler,
    validation_exception_handler,
)
from core.http_clients import close_all_clients
from core.middleware import LogHeadersMiddleware
from core.responses import ORJSONResponse
from core.swagger import setup_swagger_ui
from routes import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifecycle hooks для управления ресурсами приложения.
    """
    yield
    await close_all_clients()


app = FastAPI(
    title="Laborant API",
    description="FastAPI application with Keycloak authentication",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url="/api/openapi.json",
    default_response_class=ORJSONResponse,
)


def custom_openapi():
    """Кастомная генерация OpenAPI схемы с явным указанием версии и настройкой безопасности."""
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
    allow_origins=settings.cors_allowed_origins_list,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.cors_allow_methods_list,
    allow_headers=settings.cors_allow_headers_list,
)

app.include_router(api_router)

setup_swagger_ui(app)

app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(BusinessLogicError, business_logic_exception_handler)
