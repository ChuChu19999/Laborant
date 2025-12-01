from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.staticfiles import StaticFiles
from core.logger import logger
from core.responses import ORJSONResponse

try:
    import swagger_ui_bundle

    SWAGGER_UI_AVAILABLE = True
except ImportError:
    SWAGGER_UI_AVAILABLE = False
    swagger_ui_bundle = None


def get_swagger_ui_html_local(*args, **kwargs):
    """Получить HTML для Swagger UI с локальными файлами."""
    swagger_js_url = "/static/swagger-ui/swagger-ui-bundle.js"
    swagger_css_url = "/static/swagger-ui/swagger-ui.css"

    return get_swagger_ui_html(
        *args,
        **kwargs,
        swagger_js_url=swagger_js_url,
        swagger_css_url=swagger_css_url,
    )


def setup_swagger_ui(app: FastAPI) -> None:
    """
    Настройка Swagger UI для приложения.
    Монтирует статические файлы и настраивает эндпоинт для документации.
    """
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
            if path.exists():
                js_file = path / "swagger-ui-bundle.js"
                if js_file.exists():
                    static_path = path
                    logger.info(f"Найден swagger-ui-bundle.js в: {js_file}")
                    break

                js_files = list(path.glob("*.js"))
                css_files = list(path.glob("*.css"))
                if js_files or css_files:
                    logger.debug(
                        f"В {path} найдено JS файлов: {len(js_files)}, CSS файлов: {len(css_files)}"
                    )
                    if js_files:
                        logger.debug(
                            f"Найдены JS файлы: {[f.name for f in js_files[:5]]}"
                        )

                js_file_recursive = list(path.rglob("swagger-ui-bundle.js"))
                if js_file_recursive:
                    static_path = js_file_recursive[0].parent
                    logger.info(
                        f"Найден swagger-ui-bundle.js рекурсивно в: {js_file_recursive[0]}"
                    )
                    break

        if static_path and static_path.exists():
            app.mount(
                "/static/swagger-ui",
                StaticFiles(directory=str(static_path)),
                name="swagger-ui",
            )
            logger.info(f"Swagger UI статика смонтирована из: {static_path}")
        else:
            logger.warning(
                f"Путь к Swagger UI статике не найден. Проверенные пути: {possible_paths}"
            )
            logger.warning(
                f"Содержимое пакета swagger_ui_bundle: {list(swagger_ui_bundle_path.iterdir()) if swagger_ui_bundle_path.exists() else 'не найден'}"
            )
    except Exception as e:
        logger.warning(
            f"Ошибка при монтировании Swagger UI статики: {e}", exc_info=True
        )

    @app.get("/api/docs", include_in_schema=False)
    async def custom_swagger_ui_html(request: Request):
        """Локальный Swagger UI без доступа в интернет."""
        if not SWAGGER_UI_AVAILABLE:
            return ORJSONResponse(
                status_code=503,
                content={
                    "detail": "Swagger UI недоступен: swagger-ui-bundle не установлен"
                },
            )

        openapi_url = app.openapi_url

        return get_swagger_ui_html_local(
            openapi_url=openapi_url,
            title=app.title + " - Swagger UI",
        )
