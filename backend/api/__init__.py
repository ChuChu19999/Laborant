from __future__ import annotations
from fastapi import APIRouter, Request
from api import (
    branch,
    calculation,
    department,
    employee,
    equipment,
    fixtures,
    laboratory,
    mass_fraction,
    monitoring,
    nd_norm,
    protocol,
    protocol_template,
    report,
    research_method,
    research_method_group,
    role,
    sample,
    sample_type,
    sampling_location,
    selection_condition,
    test_object,
    test_purpose,
    user,
    user_role,
    well_mode,
)
from core.deps import DbSession
from schemas.meta import ApiIndexResponse, HealthResponse
from services.health import get_application_health
from services.meta import build_api_index

api_router = APIRouter(prefix="/api")

api_router.include_router(user.router, tags=["user"])
api_router.include_router(user_role.router, tags=["user_roles"])
api_router.include_router(employee.router, tags=["employees"])
api_router.include_router(sampling_location.router, tags=["sampling_locations"])
api_router.include_router(well_mode.router, tags=["well_modes"])
api_router.include_router(laboratory.router, tags=["laboratories"])
api_router.include_router(department.router, tags=["departments"])
api_router.include_router(branch.router, tags=["branches"])
api_router.include_router(research_method.router, tags=["research_methods"])
api_router.include_router(research_method_group.router, tags=["research_method_groups"])
api_router.include_router(sample.router, tags=["samples"])
api_router.include_router(sample_type.router, tags=["sample_types"])
api_router.include_router(test_purpose.router, tags=["test_purposes"])
api_router.include_router(selection_condition.router, tags=["selection_conditions"])
api_router.include_router(mass_fraction.router, tags=["mass_fraction_oil"])
api_router.include_router(equipment.router, tags=["equipment"])
api_router.include_router(nd_norm.router, tags=["nd_norms"])
api_router.include_router(role.router, tags=["roles"])
api_router.include_router(test_object.router, tags=["test_objects"])
api_router.include_router(protocol.router, tags=["protocols"])
api_router.include_router(protocol_template.router, tags=["protocol_templates"])
api_router.include_router(report.router, tags=["report_templates"])
api_router.include_router(calculation.router, tags=["calculations"])
api_router.include_router(monitoring.router, tags=["monitoring"])
api_router.include_router(fixtures.router, tags=["fixtures"])


@api_router.get(
    "/",
    response_model=ApiIndexResponse,
    summary="Список доступных API-эндпоинтов",
    description="Возвращает перечень эндпоинтов приложения с методами HTTP.",
    responses={
        200: {
            "description": "Список эндпоинтов успешно получен",
            "content": {
                "application/json": {
                    "example": {
                        "message": "Laborant API",
                        "endpoints": [{"method": "GET", "path": "/api/health/"}],
                        "total": 1,
                    }
                }
            },
        }
    },
)
async def root(request: Request) -> ApiIndexResponse:
    return build_api_index(request.app)


@api_router.get(
    "/health/",
    response_model=HealthResponse,
    summary="Проверка работоспособности приложения",
    description=("Возвращает статус работоспособности приложения. Используется для мониторинга и health checks."),
    responses={
        200: {
            "description": "Приложение работает",
            "content": {"application/json": {"example": {"status": "ok"}}},
        }
    },
)
async def health(db: DbSession) -> HealthResponse:
    return await get_application_health(db)
