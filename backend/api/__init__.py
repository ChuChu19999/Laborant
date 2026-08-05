from __future__ import annotations
from fastapi import APIRouter, Request
from . import (
    branches,
    calculation,
    departments,
    employees,
    equipment,
    fixtures,
    laboratories,
    mass_fraction_oil,
    nd_norm,
    protocol_templates,
    protocols,
    report,
    research_method_groups,
    research_methods,
    role,
    samples,
    sampling_locations,
    selection_conditions,
    test_object,
    user,
    user_role,
    well_modes,
)

api_router = APIRouter(prefix="/api")

api_router.include_router(user.router, tags=("user",))
api_router.include_router(user_role.router, tags=("user_role",))
api_router.include_router(employees.router, prefix="/employees", tags=("employees",))
api_router.include_router(sampling_locations.router, tags=("sampling_locations",))
api_router.include_router(well_modes.router, tags=("well_modes",))
api_router.include_router(laboratories.router, tags=("laboratories",))
api_router.include_router(departments.router, tags=("departments",))
api_router.include_router(branches.router, tags=("branches",))
api_router.include_router(research_methods.router, tags=("research_methods",))
api_router.include_router(
    research_method_groups.router, tags=("research_method_groups",)
)
api_router.include_router(samples.router, tags=("samples",))
api_router.include_router(selection_conditions.router, tags=("selection_conditions",))
api_router.include_router(mass_fraction_oil.router, tags=("mass_fraction_oil",))
api_router.include_router(equipment.router, tags=("equipment",))
api_router.include_router(nd_norm.router, tags=("nd_norm",))
api_router.include_router(role.router, tags=("role",))
api_router.include_router(test_object.router, tags=("test_object",))
api_router.include_router(protocols.router, tags=("protocols",))
api_router.include_router(protocol_templates.router, tags=("protocol_templates",))
api_router.include_router(report.router, tags=("report",))
api_router.include_router(calculation.router, tags=("calculation",))
api_router.include_router(fixtures.router, tags=("fixtures",))


@api_router.get("/")
async def root(request: Request):
    """Возвращает информацию о доступных API эндпоинтах."""
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
    summary="Проверка работоспособности приложения",
    description=(
        "Возвращает статус работоспособности приложения. "
        "Используется для мониторинга и health checks."
    ),
    responses={
        200: {
            "description": "Приложение работает",
            "content": {"application/json": {"example": {"status": "ok"}}},
        }
    },
)
async def health():
    """Возвращает статус работоспособности приложения."""
    return {"status": "ok"}
