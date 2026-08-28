from pathlib import Path
from typing import Any
from fastapi import FastAPI, Request
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response
from core.logger import logger
from core.responses import ORJSONResponse

try:
    import swagger_ui_bundle

    SWAGGER_UI_AVAILABLE = True
except ImportError:
    SWAGGER_UI_AVAILABLE = False
    swagger_ui_bundle = None


def get_swagger_ui_html_local(*args: Any, **kwargs: Any) -> HTMLResponse:
    """Вернуть HTML Swagger UI с локальными файлами."""
    swagger_js_url = "/static/swagger-ui/swagger-ui-bundle.js"
    swagger_css_url = "/static/swagger-ui/swagger-ui.css"

    return get_swagger_ui_html(
        *args,
        **kwargs,
        swagger_js_url=swagger_js_url,
        swagger_css_url=swagger_css_url,
        swagger_favicon_url="",
    )


async def custom_swagger_ui_html(request: Request) -> Response:
    """Отдать локальный Swagger UI (без доступа в интернет)."""
    if not SWAGGER_UI_AVAILABLE:
        return ORJSONResponse(
            status_code=503,
            content={"detail": "Swagger UI недоступен: swagger-ui-bundle не установлен"},
        )

    app = request.app
    openapi_url = app.openapi_url

    return get_swagger_ui_html_local(
        openapi_url=openapi_url,
        title=app.title + " - Swagger UI",
    )


def setup_swagger_ui(app: FastAPI) -> None:
    """Смонтировать статику Swagger UI и маршрут /api/docs."""
    if not SWAGGER_UI_AVAILABLE or swagger_ui_bundle is None:
        logger.warning("Swagger UI недоступен: swagger-ui-bundle не установлен")
        return

    try:
        swagger_ui_bundle_path = Path(swagger_ui_bundle.__file__).parent

        static_path = None
        possible_paths = (
            swagger_ui_bundle_path / "vendor",
            swagger_ui_bundle_path / "static",
            swagger_ui_bundle_path,
            swagger_ui_bundle_path / "swagger_ui_bundle" / "static",
        )

        for path in possible_paths:
            if not path.exists():
                continue

            js_file = path / "swagger-ui-bundle.js"
            if js_file.exists():
                static_path = path
                break

            js_file_recursive = next(path.rglob("swagger-ui-bundle.js"), None)
            if js_file_recursive is not None:
                static_path = js_file_recursive.parent
                break

        if static_path and static_path.exists():
            app.mount(
                "/static/swagger-ui",
                StaticFiles(directory=str(static_path)),
                name="swagger-ui",
            )
            logger.info("Swagger UI статика смонтирована из: {}", static_path)
            app.add_api_route(
                "/api/docs",
                custom_swagger_ui_html,
                include_in_schema=False,
                methods=["GET"],
            )
        else:
            logger.warning("Путь к Swagger UI статике не найден. Проверенные пути: {}", possible_paths)
    except OSError as exc:
        logger.warning("Ошибка при монтировании Swagger UI статики: {}", exc, exc_info=True)
