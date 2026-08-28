from __future__ import annotations
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import ConflictError, DomainValidationError, NotFoundError
from models.calculation import Calculation
from models.equipment import Equipment
from models.research import ResearchMethod, ResearchMethodGroup
from repositories import calculation as calculation_repo
from repositories.base import flush_entity
from schemas.calculation import (
    CalculateRequest,
    CalculateResponse,
    CalculationCreate,
    CalculationResponse,
    CalculationUpdate,
    EquipmentBrief,
    MethodologyChoiceCandidate,
    MethodologyChoiceResponse,
)
from schemas.role import UserPermissionsResponse
from services.access_control import enforce_crud_access
from services.calculation.compute import calculate_result
from services.equipment import get_equipment_by_ids
from services.research import (
    build_research_method_display_name,
    get_active_research_method_by_name,
    get_active_research_methods_by_name,
    require_research_method_by_id,
)
from services.sample.service import require_sample_by_id
from services.visibility import validate_lab_and_department

EquipmentIdEntry = int | dict[str, Any]


async def get_calculation_by_id(
    db: AsyncSession, calculation_id: int, include_deleted: bool = False
) -> Calculation | None:
    """Получить расчёт по ID."""
    return await calculation_repo.get_calculation_by_id(db, calculation_id, include_deleted)


async def require_calculation_by_id(
    db: AsyncSession, calculation_id: int, include_deleted: bool = False
) -> Calculation:
    """Вернуть расчёт по ID, иначе вызвать NotFoundError."""
    calculation = await get_calculation_by_id(db, calculation_id, include_deleted)
    if not calculation:
        raise NotFoundError("Расчёт не найден")
    return calculation


def _primary_research_method_group(method: ResearchMethod) -> ResearchMethodGroup | None:
    """Вернуть активную группу методики, иначе первую из списка."""
    if not method.groups:
        return None
    return next(
        (group for group in method.groups if group.deleted_at is None),
        method.groups[0],
    )


def _research_method_payload_for_compute(method: ResearchMethod) -> dict[str, Any]:
    """Собрать словарь методики для передачи в calculate_result."""
    groups = method.groups or []
    primary_group = _primary_research_method_group(method)
    return {
        "id": method.id,
        "name": method.name,
        "formula": method.formula,
        "measurement_error": method.measurement_error,
        "unit": method.unit,
        "rounding_type": method.rounding_type,
        "rounding_decimal": method.rounding_decimal,
        "intermediate_data": method.intermediate_data,
        "convergence_conditions": method.convergence_conditions,
        "groups": [{"id": group.id, "name": group.name} for group in groups],
        "group_name": primary_group.name if primary_group else "",
    }


def _resolve_equipment_ids(equipment_data: list[EquipmentIdEntry] | None) -> list[int]:
    """Извлечь ID оборудования из equipment_data расчёта."""
    if not equipment_data:
        return []
    equipment_ids: list[int] = []
    for entry in equipment_data:
        eq_id: Any = entry.get("id", entry) if isinstance(entry, dict) else entry
        if isinstance(eq_id, int):
            equipment_ids.append(eq_id)
    return equipment_ids


def _collect_equipment_ids_from_calculations(calculations: list[Calculation]) -> list[int]:
    """Собрать уникальные ID оборудования из списка расчётов."""
    equipment_ids: set[int] = set()
    for calculation in calculations:
        equipment_ids.update(_resolve_equipment_ids(calculation.equipment_data))
    return list(equipment_ids)


def build_calculation_response(
    calculation: Calculation,
    *,
    equipment: list[Equipment] | None = None,
) -> CalculationResponse:
    """Собрать CalculationResponse из ORM-расчёта и списка оборудования."""
    response = CalculationResponse.model_validate(calculation)
    if equipment is None:
        return response
    return response.model_copy(update={"equipment": [EquipmentBrief.model_validate(item) for item in equipment]})


def _equipment_list_from_map(
    calculation: Calculation,
    equipment_map: dict[int, Equipment],
) -> list[Equipment]:
    """Вернуть приборы расчёта из уже загруженного словаря оборудования по id."""
    return [
        equipment_map[eq_id] for eq_id in _resolve_equipment_ids(calculation.equipment_data) if eq_id in equipment_map
    ]


async def _load_equipment_for_calculations(
    db: AsyncSession,
    calculations: list[Calculation],
) -> dict[int, Equipment]:
    """Пакетно загрузить оборудование для списка расчётов."""
    return await get_equipment_by_ids(
        db,
        _collect_equipment_ids_from_calculations(calculations),
        include_deleted=True,
    )


def build_calculation_responses(
    calculations: list[Calculation],
    equipment_map: dict[int, Equipment],
) -> list[CalculationResponse]:
    """Собрать список CalculationResponse с оборудованием."""
    return [
        build_calculation_response(
            calculation,
            equipment=_equipment_list_from_map(calculation, equipment_map),
        )
        for calculation in calculations
    ]


async def get_calculations_by_sample(
    db: AsyncSession,
    sample_id: int | None = None,
    sample_ids: list[int] | None = None,
    include_deleted: bool = False,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> list[CalculationResponse]:
    """Получить список расчётов по пробе без пагинации."""
    calculations = await calculation_repo.get_calculations_by_sample(
        db, sample_id, sample_ids, include_deleted, sort_by, sort_order
    )
    equipment_map = await _load_equipment_for_calculations(db, calculations)
    return build_calculation_responses(calculations, equipment_map)


async def get_calculations(
    db: AsyncSession,
    sample_id: int | None = None,
    sample_ids: list[int] | None = None,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    research_method_id: int | None = None,
    include_deleted: bool = False,
    page: int | None = None,
    page_size: int | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[CalculationResponse], int]:
    """Получить список расчётов."""
    calculations, total = await calculation_repo.get_calculations(
        db,
        sample_id,
        sample_ids,
        laboratory_id,
        department_id,
        research_method_id,
        include_deleted,
        page,
        page_size,
        sort_by,
        sort_order,
    )
    equipment_map = await _load_equipment_for_calculations(db, calculations)
    return build_calculation_responses(calculations, equipment_map), total


async def create_calculation(db: AsyncSession, calculation_data: CalculationCreate) -> Calculation:
    """Создать расчёт."""
    await require_sample_by_id(db, calculation_data.sample_id)
    await validate_lab_and_department(db, calculation_data.laboratory_id, calculation_data.department_id)
    await require_research_method_by_id(db, calculation_data.research_method_id)

    if await calculation_repo.exists_calculation_by_sample_and_method(
        db,
        calculation_data.sample_id,
        calculation_data.research_method_id,
    ):
        raise ConflictError("Расчёт для данной пробы и метода исследования уже существует")

    calculation = Calculation(
        input_data=calculation_data.input_data,
        equipment_data=calculation_data.equipment_data or [],
        result=calculation_data.result,
        executor=calculation_data.executor,
        measurement_error=calculation_data.measurement_error,
        unit=calculation_data.unit,
        laboratory_activity_date=calculation_data.laboratory_activity_date,
        sample_id=calculation_data.sample_id,
        laboratory_id=calculation_data.laboratory_id,
        department_id=calculation_data.department_id,
        research_method_id=calculation_data.research_method_id,
    )
    await calculation_repo.add_calculation(db, calculation)
    return await require_calculation_by_id(db, calculation.id)


async def update_calculation(
    db: AsyncSession,
    calculation: Calculation,
    calculation_data: CalculationUpdate,
) -> Calculation:
    """Обновить расчёт."""
    update_data = calculation_data.model_dump(exclude_unset=True)

    if "sample_id" in update_data or "research_method_id" in update_data:
        sample_id = update_data.get("sample_id", calculation.sample_id)
        method_id = update_data.get("research_method_id", calculation.research_method_id)

        if await calculation_repo.exists_calculation_by_sample_and_method(
            db, sample_id, method_id, exclude_id=calculation.id
        ):
            raise ConflictError("Расчёт для данной пробы и метода исследования уже существует")

    for key, value in update_data.items():
        setattr(calculation, key, value)

    if "laboratory_id" in update_data or "department_id" in update_data:
        await validate_lab_and_department(db, calculation.laboratory_id, calculation.department_id)

    await flush_entity(db)
    return await require_calculation_by_id(db, calculation.id)


async def delete_calculation(db: AsyncSession, calculation: Calculation) -> None:
    """Мягко удалить расчёт."""
    calculation.soft_delete()
    await flush_entity(db)


async def get_calculation_for_response(db: AsyncSession, calculation: Calculation) -> CalculationResponse:
    """Получить расчёт с оборудованием для ответа API."""
    equipment_map = await _load_equipment_for_calculations(db, [calculation])
    return build_calculation_response(
        calculation,
        equipment=_equipment_list_from_map(calculation, equipment_map),
    )


async def create_calculation_for_response(db: AsyncSession, calculation_data: CalculationCreate) -> CalculationResponse:
    """Создать расчёт и вернуть ответ API."""
    calculation = await create_calculation(db, calculation_data)
    return await get_calculation_for_response(db, calculation)


async def update_calculation_for_response(
    db: AsyncSession,
    calculation_id: int,
    calculation_data: CalculationUpdate,
    *,
    calculation: Calculation | None = None,
) -> CalculationResponse:
    """Обновить расчёт по ID и вернуть ответ API."""
    if calculation is None:
        calculation = await require_calculation_by_id(db, calculation_id)
    updated = await update_calculation(db, calculation, calculation_data)
    return await get_calculation_for_response(db, updated)


def resolve_calculation_update_scope(
    existing: Calculation,
    calculation_data: CalculationUpdate,
) -> tuple[int, int | None]:
    """Определить область доступа после PATCH расчёта."""
    # Важно: явно переданный `department_id=None` должен считаться изменением.
    # Поэтому нельзя использовать `or` (оно перетирает None существующим значением).
    fields_set = calculation_data.model_fields_set
    laboratory_id = (
        calculation_data.laboratory_id
        if "laboratory_id" in fields_set and calculation_data.laboratory_id is not None
        else existing.laboratory_id
    )
    department_id = calculation_data.department_id if "department_id" in fields_set else existing.department_id
    return (laboratory_id, department_id)


def resolve_calculation_replace_scope(
    existing: Calculation,
    calculation_data: CalculationCreate,
) -> tuple[int, int | None]:
    """Определить область доступа при замене расчёта новой версией."""
    fields_set = calculation_data.model_fields_set
    laboratory_id = (
        calculation_data.laboratory_id
        if "laboratory_id" in fields_set and calculation_data.laboratory_id is not None
        else existing.laboratory_id
    )
    department_id = calculation_data.department_id if "department_id" in fields_set else existing.department_id
    return (laboratory_id, department_id)


async def replace_calculation_for_response(
    db: AsyncSession,
    calculation_id: int,
    calculation_data: CalculationCreate,
    *,
    calculation: Calculation | None = None,
) -> CalculationResponse:
    """Заменить расчёт и вернуть ответ API."""
    if calculation is None:
        calculation = await require_calculation_by_id(db, calculation_id)
    replaced = await replace_calculation(db, calculation, calculation_data)
    return await get_calculation_for_response(db, replaced)


async def execute_calculation_with_access(
    db: AsyncSession,
    effective: UserPermissionsResponse,
    request: CalculateRequest,
) -> CalculateResponse:
    """Выполнить расчёт с проверкой прав доступа."""
    method = await require_research_method_by_id(db, request.research_method_id)
    enforce_crud_access(
        effective,
        "calculations",
        "execute",
        method.laboratory_id,
        method.department_id,
    )
    return await execute_calculation(db, request, research_method=method)


async def execute_calculation(
    db: AsyncSession,
    request: CalculateRequest,
    *,
    research_method: ResearchMethod | None = None,
) -> CalculateResponse:
    """Выполнить расчёт по методу исследования и входным данным."""
    method = research_method or await require_research_method_by_id(
        db, request.research_method_id, include_deleted=True
    )
    try:
        return await calculate_result(
            db=db,
            input_data=request.input_data,
            research_method=_research_method_payload_for_compute(method),
        )
    except ValueError as exc:
        raise DomainValidationError(str(exc)) from exc


async def get_calculation_methodology_choice(
    db: AsyncSession,
    calculation: Calculation,
) -> MethodologyChoiceResponse:
    """Проверить, появилась ли новая версия методики для сохранённого расчёта."""
    stored_method = await require_research_method_by_id(db, calculation.research_method_id, include_deleted=True)

    stored_method_deleted = stored_method.deleted_at is not None
    stored_group = _primary_research_method_group(stored_method)
    stored_group_id = stored_group.id if stored_group else None
    stored_group_name = stored_group.name if stored_group else None
    method_display_name = build_research_method_display_name(stored_method)

    if not stored_method_deleted:
        return MethodologyChoiceResponse(
            methodology_changed=False,
            method_name=method_display_name,
            stored_method_id=stored_method.id,
            stored_method_deleted=False,
            current_method_id=stored_method.id,
            stored_method_group_id=stored_group_id,
            stored_method_group_name=stored_group_name,
        )

    active_methods = await get_active_research_methods_by_name(
        db,
        name=stored_method.name,
        laboratory_id=calculation.laboratory_id,
        department_id=calculation.department_id,
    )

    if stored_group_name is not None:
        grouped_methods = [
            method for method in active_methods if any(group.name == stored_group_name for group in method.groups)
        ]
        if grouped_methods:
            active_methods = grouped_methods

    if not active_methods:
        return MethodologyChoiceResponse(
            methodology_changed=False,
            method_name=method_display_name,
            stored_method_id=stored_method.id,
            stored_method_deleted=True,
            current_method_id=None,
            stored_method_group_id=stored_group_id,
            stored_method_group_name=stored_group_name,
        )

    if len(active_methods) > 1:
        return MethodologyChoiceResponse(
            methodology_changed=True,
            method_name=method_display_name,
            stored_method_id=stored_method.id,
            stored_method_deleted=True,
            current_method_id=None,
            methodology_ambiguous=True,
            candidate_methods=[
                MethodologyChoiceCandidate(
                    id=method.id,
                    name=build_research_method_display_name(method),
                )
                for method in active_methods
            ],
            stored_method_group_id=stored_group_id,
            stored_method_group_name=stored_group_name,
        )

    current_method = active_methods[0]
    return MethodologyChoiceResponse(
        methodology_changed=current_method.id != stored_method.id,
        method_name=method_display_name,
        stored_method_id=stored_method.id,
        stored_method_deleted=True,
        current_method_id=current_method.id,
        stored_method_group_id=stored_group_id,
        stored_method_group_name=stored_group_name,
    )


async def _validate_research_method_version_change(
    db: AsyncSession,
    old_method_id: int,
    new_method_id: int,
    laboratory_id: int,
    department_id: int | None,
) -> None:
    """Разрешить смену метода только при переходе на актуальную версию той же методики."""
    old_method = await require_research_method_by_id(db, old_method_id, include_deleted=True)
    new_method = await require_research_method_by_id(db, new_method_id, include_deleted=False)
    if old_method.name != new_method.name:
        raise DomainValidationError("Новая методика должна иметь то же наименование, что и в сохранённом расчёте")
    if old_method.laboratory_id != new_method.laboratory_id:
        raise DomainValidationError("Новая методика должна относиться к той же лаборатории")
    old_department = old_method.department_id if old_method.department_id is not None else None
    new_department = new_method.department_id if new_method.department_id is not None else None
    if old_department != new_department:
        raise DomainValidationError("Новая методика должна относиться к тому же подразделению")
    if old_method.deleted_at is None:
        raise DomainValidationError("При замене расчёта нельзя менять метод исследования")

    stored_group = _primary_research_method_group(old_method)
    stored_group_name = stored_group.name if stored_group else None
    active_method = await get_active_research_method_by_name(
        db,
        name=new_method.name,
        laboratory_id=laboratory_id,
        department_id=department_id,
        group_name=stored_group_name,
    )
    if not active_method or active_method.id != new_method.id:
        raise DomainValidationError("Новая методика должна быть актуальной версией в справочнике")


async def replace_calculation(
    db: AsyncSession,
    calculation: Calculation,
    calculation_data: CalculationCreate,
) -> Calculation:
    """Мягко удалить расчёт и создать новую запись; метод — та же методика или её актуальная версия."""
    if calculation_data.sample_id != calculation.sample_id:
        raise DomainValidationError("При замене расчёта нельзя менять пробу")
    if calculation_data.research_method_id != calculation.research_method_id:
        await _validate_research_method_version_change(
            db,
            old_method_id=calculation.research_method_id,
            new_method_id=calculation_data.research_method_id,
            laboratory_id=calculation_data.laboratory_id,
            department_id=calculation_data.department_id,
        )
    if calculation_data.laboratory_id != calculation.laboratory_id:
        raise DomainValidationError("При замене расчёта нельзя менять лабораторию")

    old_department = calculation.department_id if calculation.department_id is not None else None
    new_department = calculation_data.department_id if calculation_data.department_id is not None else None
    if old_department != new_department:
        raise DomainValidationError("При замене расчёта нельзя менять подразделение")

    calculation.soft_delete()
    await flush_entity(db)
    return await create_calculation(db, calculation_data)
