from fastapi import APIRouter, Request
from routes import (
    calculation,
    employees,
    equipment,
    fixtures,
    laboratory,
    nd_norm,
    protocol,
    report,
    research,
    role,
    sample,
    test_object,
    user,
)

api_router = APIRouter(prefix="/api")

api_router.include_router(user.router, tags=("user",))
api_router.include_router(employees.router, prefix="/employees", tags=("employees",))
api_router.include_router(laboratory.router, tags=("laboratory",))
api_router.include_router(research.router, tags=("research",))
api_router.include_router(sample.router, tags=("sample",))
api_router.include_router(equipment.router, tags=("equipment",))
api_router.include_router(nd_norm.router, tags=("nd_norm",))
api_router.include_router(role.router, tags=("role",))
api_router.include_router(test_object.router, tags=("test_object",))
api_router.include_router(protocol.router, tags=("protocol",))
api_router.include_router(report.router, tags=("report",))
api_router.include_router(calculation.router, tags=("calculation",))
api_router.include_router(fixtures.router, tags=("fixtures",))


@api_router.get("/")
async def root(request: Request):
    """Информация о доступных API эндпоинтах."""
    app = request.app
    endpoints = []
    for route in app.routes:
        if hasattr(route, "path") and hasattr(route, "methods"):
            path = route.path
            if path.startswith("/api"):
                for method in route.methods:
                    if method != "HEAD":
                        endpoint_info = {
                            "method": method,
                            "path": path,
                        }
                        endpoints.append(endpoint_info)
    return {
        "message": "Laborant API",
        "endpoints": sorted(endpoints, key=lambda x: (x["path"], x["method"])),
        "total": len(endpoints),
    }


@api_router.get(
    "/health/",
    summary="Проверка состояния API",
    description=(
        "Эндпоинт для проверки работоспособности API. "
        "Используется для мониторинга и health checks."
    ),
    responses={
        200: {
            "description": "API работает",
            "content": {"application/json": {"example": {"status": "ok"}}},
        }
    },
)
async def health():
    """
    Проверка состояния API.

    Возвращает статус "ok" если API работает.
    """
    return {"status": "ok"}
