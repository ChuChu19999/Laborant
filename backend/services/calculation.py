from __future__ import annotations
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import ConflictError, NotFoundError, ValidationError
from core.logger import logger
from models.calculation import Calculation
from models.equipment import Equipment
from repositories import calculation as calculation_repo
from repositories import laboratory as laboratory_repo
from repositories import research as research_repo
from repositories import sample as sample_repo
from repositories.base import flush_entity
from schemas.calculation import (
    CalculateRequest,
    CalculationCreate,
    CalculationResponse,
    CalculationUpdate,
    EquipmentBrief,
    MethodologyChoiceCandidate,
    MethodologyChoiceResponse,
)
from schemas.sample import SampleResponse
from services.calculator import calculate_result
from services.equipment import get_equipment_by_id, get_equipment_by_ids
from services.research import (
    build_research_method_display_name,
    get_active_research_method_by_name,
    get_active_research_methods_by_name,
    get_research_method_by_id,
)
from services.visibility import validate_lab_and_department
from utils.pagination import calculate_total_pages


async def get_calculation_by_id(
    db: AsyncSession, calculation_id: int, include_deleted: bool = False
) -> Optional[Calculation]:
    """Получить расчет по ID."""
    return await calculation_repo.get_calculation_by_id(
        db, calculation_id, include_deleted
    )


async def get_calculations_by_sample(
    db: AsyncSession,
    sample_id: Optional[int] = None,
    sample_ids: Optional[List[int]] = None,
    include_deleted: bool = False,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> List[Calculation]:
    """Получить список расчетов по пробе без пагинации."""
    return await calculation_repo.get_calculations_by_sample(
        db, sample_id, sample_ids, include_deleted, sort_by, sort_order
    )


async def get_calculations(
    db: AsyncSession,
    sample_id: Optional[int] = None,
    sample_ids: Optional[List[int]] = None,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
    research_method_id: Optional[int] = None,
    include_deleted: bool = False,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[List[Calculation], int, int]:
    """Получить список расчетов."""
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

    if page is not None and page_size is not None:
        total_pages = calculate_total_pages(total, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    return calculations, total, total_pages


async def create_calculation(
    db: AsyncSession, calculation_data: CalculationCreate
) -> Calculation:
    """Создать расчет."""
    if not await sample_repo.get_sample_by_id(db, calculation_data.sample_id):
        raise NotFoundError("Проба не найдена")

    await validate_lab_and_department(
        db, calculation_data.laboratory_id, calculation_data.department_id
    )

    if not await research_repo.get_research_method_by_id(
        db, calculation_data.research_method_id
    ):
        raise NotFoundError("Метод исследования не найден")

    if await calculation_repo.exists_calculation_by_sample_and_method(
        db,
        calculation_data.sample_id,
        calculation_data.research_method_id,
    ):
        raise ConflictError(
            "Расчет для данной пробы и метода исследования уже существует"
        )

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
    return await calculation_repo.add_calculation(db, calculation)


async def update_calculation(
    db: AsyncSession, calculation_id: int, calculation_data: CalculationUpdate
) -> Calculation:
    """Обновить расчет."""
    calculation = await get_calculation_by_id(db, calculation_id)
    if not calculation:
        raise NotFoundError("Расчет не найден")

    update_data = calculation_data.model_dump(exclude_unset=True)

    if "sample_id" in update_data or "research_method_id" in update_data:
        sample_id = update_data.get("sample_id", calculation.sample_id)
        method_id = update_data.get(
            "research_method_id", calculation.research_method_id
        )

        if await calculation_repo.exists_calculation_by_sample_and_method(
            db, sample_id, method_id, exclude_id=calculation_id
        ):
            raise ConflictError(
                "Расчет для данной пробы и метода исследования уже существует"
            )

    for key, value in update_data.items():
        setattr(calculation, key, value)

    if (
        calculation_data.laboratory_id is not None
        or calculation_data.department_id is not None
    ):
        lab_id = (
            calculation_data.laboratory_id
            if calculation_data.laboratory_id is not None
            else calculation.laboratory_id
        )
        dept_id = (
            calculation_data.department_id
            if calculation_data.department_id is not None
            else calculation.department_id
        )

        if dept_id:
            dept = await laboratory_repo.get_department_by_id(db, dept_id)
            if not dept:
                raise NotFoundError("Подразделение не найдено")
            if lab_id and dept.laboratory_id != lab_id:
                raise ValidationError(
                    "Подразделение должно принадлежать выбранной лаборатории"
                )

    await flush_entity(db)
    return calculation


async def delete_calculation(db: AsyncSession, calculation_id: int) -> None:
    """Удалить расчет (мягкое удаление)."""
    calculation = await get_calculation_by_id(db, calculation_id)
    if not calculation:
        raise NotFoundError("Расчет не найден")

    calculation.soft_delete()
    await flush_entity(db)


async def get_calculation_response_data(
    db: AsyncSession, calculation_id: int
) -> CalculationResponse:
    """Получить расчёт с данными для ответа API."""
    calculation = await calculation_repo.get_calculation_by_id(db, calculation_id)
    if not calculation:
        raise NotFoundError("Расчет не найден")
    return await _build_calculation_response(db, calculation)


def _calculation_to_flat_response_dict(calculation: Calculation) -> dict:
    """Поля расчёта для ответа API; проба, методика и оборудование добавляются отдельно."""
    return {
        "id": calculation.id,
        "sample_id": calculation.sample_id,
        "laboratory_id": calculation.laboratory_id,
        "department_id": calculation.department_id,
        "research_method_id": calculation.research_method_id,
        "input_data": calculation.input_data,
        "equipment_data": calculation.equipment_data,
        "result": calculation.result,
        "executor": calculation.executor,
        "measurement_error": calculation.measurement_error,
        "unit": calculation.unit,
        "laboratory_activity_date": calculation.laboratory_activity_date,
        "created_at": calculation.created_at,
        "updated_at": calculation.updated_at,
        "deleted_at": calculation.deleted_at,
        "sample": None,
        "research_method": None,
        "equipment": None,
    }


def _collect_equipment_ids_from_calculations(
    calculations: list[Calculation],
) -> list[int]:
    """Собрать уникальные ID оборудования из списка расчётов."""
    equipment_ids: set[int] = set()
    for calculation in calculations:
        if not calculation.equipment_data:
            continue
        for eq_id in calculation.equipment_data:
            if isinstance(eq_id, dict):
                eq_id = eq_id.get("id", eq_id)
            if isinstance(eq_id, int):
                equipment_ids.add(eq_id)
    return list(equipment_ids)


def _resolve_equipment_ids(equipment_data: list) -> list[int]:
    """Извлечь ID оборудования из equipment_data расчёта."""
    equipment_ids: list[int] = []
    for eq_id in equipment_data:
        if isinstance(eq_id, dict):
            eq_id = eq_id.get("id", eq_id)
        if isinstance(eq_id, int):
            equipment_ids.append(eq_id)
    return equipment_ids


async def _build_calculation_response(
    db: AsyncSession,
    calculation: Calculation,
    equipment_map: Optional[dict[int, Equipment]] = None,
) -> CalculationResponse:
    """Собрать ответ API по расчёту с загруженными связями."""
    calc_dict = CalculationResponse.model_validate(
        _calculation_to_flat_response_dict(calculation)
    ).model_dump()

    if calculation.equipment_data:
        equipment_list = []
        for eq_id in _resolve_equipment_ids(calculation.equipment_data):
            equipment = (
                equipment_map.get(eq_id)
                if equipment_map is not None
                else await get_equipment_by_id(db, eq_id, include_deleted=True)
            )
            if equipment:
                equipment_list.append(
                    EquipmentBrief.model_validate(equipment).model_dump()
                )
        calc_dict["equipment"] = equipment_list

    if calculation.sample:
        sample_dict = SampleResponse.model_validate(calculation.sample).model_dump()
        if calculation.sample.laboratory:
            sample_dict["laboratory_name"] = calculation.sample.laboratory.name
        if calculation.sample.department:
            sample_dict["department_name"] = calculation.sample.department.name
        calc_dict["sample"] = sample_dict

    if calculation.research_method:
        calc_dict["research_method"] = {
            "id": calculation.research_method.id,
            "name": calculation.research_method.name,
            "unit": calculation.research_method.unit,
        }

    return CalculationResponse(**calc_dict)


async def _build_calculation_response_with_equipment_map(
    db: AsyncSession,
    calculation: Calculation,
    equipment_map: Optional[dict[int, Equipment]] = None,
) -> CalculationResponse:
    """Собрать ответ по расчёту с предзагруженным словарём оборудования."""
    return await _build_calculation_response(db, calculation, equipment_map)


async def get_calculations_response_data(
    db: AsyncSession,
    calculations: list[Calculation],
) -> list[CalculationResponse]:
    """Собрать ответы по списку расчётов с пакетной загрузкой оборудования."""
    equipment_ids = _collect_equipment_ids_from_calculations(calculations)
    equipment_map = await get_equipment_by_ids(db, equipment_ids, include_deleted=True)
    return [
        await _build_calculation_response_with_equipment_map(
            db, calculation, equipment_map
        )
        for calculation in calculations
    ]


async def execute_calculation(db: AsyncSession, request: CalculateRequest) -> dict:
    """Выполнить расчёт по методу исследования и входным данным."""
    try:
        research_method_obj = await get_research_method_by_id(
            db, request.research_method_id, include_deleted=True
        )
        if not research_method_obj:
            raise NotFoundError("Метод исследования не найден")

        research_method = {
            "id": research_method_obj.id,
            "name": research_method_obj.name,
            "formula": research_method_obj.formula,
            "measurement_error": research_method_obj.measurement_error,
            "unit": research_method_obj.unit,
            "rounding_type": research_method_obj.rounding_type,
            "rounding_decimal": research_method_obj.rounding_decimal,
            "intermediate_data": research_method_obj.intermediate_data,
            "convergence_conditions": research_method_obj.convergence_conditions,
            "groups": [
                {"id": group.id, "name": group.name}
                for group in (research_method_obj.groups or [])
            ],
            "group_name": (
                research_method_obj.groups[0].name
                if getattr(research_method_obj, "groups", None)
                and len(research_method_obj.groups) > 0
                else ""
            ),
        }

        return await calculate_result(
            db=db,
            input_data=request.input_data,
            research_method=research_method,
        )
    except NotFoundError:
        raise
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc
    except Exception as exc:
        logger.error(f"Ошибка при расчете: {str(exc)}", exc_info=True)
        raise ValidationError(f"Ошибка при расчете: {str(exc)}") from exc


async def get_calculation_methodology_choice(
    db: AsyncSession,
    calculation_id: int,
) -> MethodologyChoiceResponse:
    """Проверить, появилась ли новая версия методики для сохранённого расчёта."""
    calculation = await get_calculation_by_id(db, calculation_id)
    if not calculation:
        raise NotFoundError("Расчет не найден")

    stored_method = await get_research_method_by_id(
        db, calculation.research_method_id, include_deleted=True
    )
    if not stored_method:
        raise NotFoundError("Метод исследования не найден")

    stored_method_deleted = stored_method.deleted_at is not None
    stored_group = None
    if stored_method.groups:
        stored_group = next(
            (group for group in stored_method.groups if group.deleted_at is None),
            stored_method.groups[0],
        )
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
            method
            for method in active_methods
            if any(group.name == stored_group_name for group in method.groups)
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
    department_id: Optional[int],
) -> None:
    """Разрешить смену метода только при переходе на актуальную версию той же методики."""
    old_method = await get_research_method_by_id(
        db, old_method_id, include_deleted=True
    )
    new_method = await get_research_method_by_id(
        db, new_method_id, include_deleted=False
    )
    if not old_method:
        raise NotFoundError("Исходный метод исследования не найден")
    if not new_method:
        raise NotFoundError("Новый метод исследования не найден")
    if old_method.name != new_method.name:
        raise ValidationError(
            "Новая методика должна иметь то же наименование, что и в сохранённом расчёте"
        )
    if old_method.laboratory_id != new_method.laboratory_id:
        raise ValidationError("Новая методика должна относиться к той же лаборатории")
    old_department = (
        old_method.department_id if old_method.department_id is not None else None
    )
    new_department = (
        new_method.department_id if new_method.department_id is not None else None
    )
    if old_department != new_department:
        raise ValidationError(
            "Новая методика должна относиться к тому же подразделению"
        )
    if old_method.deleted_at is None:
        raise ValidationError("При замене расчёта нельзя менять метод исследования")

    stored_group = None
    if old_method.groups:
        stored_group = next(
            (group for group in old_method.groups if group.deleted_at is None),
            old_method.groups[0],
        )
    stored_group_name = stored_group.name if stored_group else None
    active_method = await get_active_research_method_by_name(
        db,
        name=new_method.name,
        laboratory_id=laboratory_id,
        department_id=department_id,
        group_name=stored_group_name,
    )
    if not active_method or active_method.id != new_method.id:
        raise ValidationError(
            "Новая методика должна быть актуальной версией в справочнике"
        )


async def replace_calculation(
    db: AsyncSession,
    calculation_id: int,
    calculation_data: CalculationCreate,
) -> Calculation:
    """Мягко удаляет расчёт по id и создаёт новую запись с теми же пробой и методом."""
    old = await get_calculation_by_id(db, calculation_id)
    if not old:
        raise NotFoundError("Расчет не найден")

    if calculation_data.sample_id != old.sample_id:
        raise ValidationError("При замене расчёта нельзя менять пробу")
    if calculation_data.research_method_id != old.research_method_id:
        await _validate_research_method_version_change(
            db,
            old_method_id=old.research_method_id,
            new_method_id=calculation_data.research_method_id,
            laboratory_id=calculation_data.laboratory_id,
            department_id=calculation_data.department_id,
        )
    if calculation_data.laboratory_id != old.laboratory_id:
        raise ValidationError("При замене расчёта нельзя менять лабораторию")

    old_department = old.department_id if old.department_id is not None else None
    new_department = (
        calculation_data.department_id
        if calculation_data.department_id is not None
        else None
    )
    if old_department != new_department:
        raise ValidationError("При замене расчёта нельзя менять подразделение")

    old.soft_delete()
    await flush_entity(db)
    return await create_calculation(db, calculation_data)
