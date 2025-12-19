from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.exceptions import NotFoundError, ValidationError
from core.logger import logger
from core.security import IsAuthenticated
from schemas.calculation import (
    CalculateRequest,
    CalculationCreate,
    CalculationResponse,
    CalculationUpdate,
    EquipmentBrief,
)
from schemas.pagination import PaginatedResponse
from schemas.sample import SampleResponse
from services.calculation import (
    create_calculation,
    delete_calculation,
    get_calculation_by_id,
    get_calculations,
    get_calculations_by_sample,
    update_calculation,
)
from services.calculator import calculate_result
from services.equipment import get_equipment_by_id
from services.research import get_research_method_by_id

router = APIRouter()


@router.get(
    "/calculations/",
    response_model=PaginatedResponse[CalculationResponse],
    summary="Получение списка расчетов",
    description=(
        "Возвращает список расчетов с пагинацией. "
        "Поддерживает фильтрацию по пробам, лабораториям, подразделениям и методам исследования. "
        "Можно указать несколько ID проб через запятую в параметре sample_ids."
    ),
    responses={
        200: {"description": "Список расчетов успешно получен"},
    },
)
# @IsAuthenticated
async def list_calculations(
    sample_id: Optional[int] = Query(None),
    sample_ids: Optional[str] = Query(None, description="Список ID проб через запятую"),
    laboratory_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    research_method_id: Optional[int] = Query(None),
    include_deleted: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает список расчетов с пагинацией."""
    sample_ids_list = None
    if sample_ids:
        try:
            sample_ids_list = [
                int(id.strip()) for id in sample_ids.split(",") if id.strip()
            ]
        except ValueError:
            pass

    calculations, total, total_pages = await get_calculations(
        db,
        sample_id=sample_id,
        sample_ids=sample_ids_list,
        laboratory_id=laboratory_id,
        department_id=department_id,
        research_method_id=research_method_id,
        include_deleted=include_deleted,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    items = []
    for calc in calculations:
        calc_dict = CalculationResponse.model_validate(calc).model_dump()

        if calc.equipment_data:
            equipment_list = []
            for eq_id in calc.equipment_data:
                if isinstance(eq_id, dict):
                    eq_id = eq_id.get("id", eq_id)
                equipment = await get_equipment_by_id(db, eq_id)
                if equipment:
                    equipment_list.append(
                        EquipmentBrief.model_validate(equipment).model_dump()
                    )
            calc_dict["equipment"] = equipment_list

        if hasattr(calc, "sample") and calc.sample:
            sample_dict = SampleResponse.model_validate(calc.sample).model_dump()
            if hasattr(calc.sample, "laboratory") and calc.sample.laboratory:
                sample_dict["laboratory_name"] = calc.sample.laboratory.name
            if hasattr(calc.sample, "department") and calc.sample.department:
                sample_dict["department_name"] = calc.sample.department.name
            calc_dict["sample"] = sample_dict

        if hasattr(calc, "research_method") and calc.research_method:
            calc_dict["research_method"] = {
                "id": calc.research_method.id,
                "name": calc.research_method.name,
                "unit": calc.research_method.unit,
            }

        items.append(CalculationResponse(**calc_dict))

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/calculations/by-sample/{sample_id}/",
    response_model=List[CalculationResponse],
    summary="Получение расчетов по пробе",
    description="Возвращает все расчеты для указанной пробы без пагинации.",
    responses={
        200: {"description": "Список расчетов успешно получен"},
    },
)
# @IsAuthenticated
async def get_calculations_by_sample_endpoint(
    sample_id: int,
    include_deleted: bool = Query(False),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает все расчеты для указанной пробы без пагинации."""
    calculations = await get_calculations_by_sample(
        db,
        sample_id=sample_id,
        include_deleted=include_deleted,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    items = []
    for calc in calculations:
        calc_dict = CalculationResponse.model_validate(calc).model_dump()

        if calc.equipment_data:
            equipment_list = []
            for eq_id in calc.equipment_data:
                if isinstance(eq_id, dict):
                    eq_id = eq_id.get("id", eq_id)
                equipment = await get_equipment_by_id(db, eq_id)
                if equipment:
                    equipment_list.append(
                        EquipmentBrief.model_validate(equipment).model_dump()
                    )
            calc_dict["equipment"] = equipment_list

        if hasattr(calc, "sample") and calc.sample:
            sample_dict = SampleResponse.model_validate(calc.sample).model_dump()
            if hasattr(calc.sample, "laboratory") and calc.sample.laboratory:
                sample_dict["laboratory_name"] = calc.sample.laboratory.name
            if hasattr(calc.sample, "department") and calc.sample.department:
                sample_dict["department_name"] = calc.sample.department.name
            calc_dict["sample"] = sample_dict

        if hasattr(calc, "research_method") and calc.research_method:
            calc_dict["research_method"] = {
                "id": calc.research_method.id,
                "name": calc.research_method.name,
                "unit": calc.research_method.unit,
            }

        items.append(CalculationResponse(**calc_dict))

    return items


@router.post(
    "/calculations/",
    response_model=CalculationResponse,
    status_code=201,
    summary="Создание нового расчета",
    description=(
        "Создает новый расчет на основе переданных данных. "
        "Расчет привязывается к пробе и методу исследования."
    ),
    responses={
        201: {"description": "Расчет успешно создан"},
        400: {"description": "Некорректные данные для создания расчета"},
    },
)
# @IsAuthenticated
async def create_calculation_endpoint(
    calculation_data: CalculationCreate,
    db: AsyncSession = Depends(get_db),
):
    """Создает новый расчет на основе переданных данных."""
    calculation = await create_calculation(db, calculation_data)
    await db.commit()
    calc_dict = CalculationResponse.model_validate(calculation).model_dump()

    if calculation.equipment_data:
        equipment_list = []
        for eq_id in calculation.equipment_data:
            if isinstance(eq_id, dict):
                eq_id = eq_id.get("id", eq_id)
            equipment = await get_equipment_by_id(db, eq_id)
            if equipment:
                equipment_list.append(
                    EquipmentBrief.model_validate(equipment).model_dump()
                )
        calc_dict["equipment"] = equipment_list

    return CalculationResponse(**calc_dict)


@router.get(
    "/calculations/{calculation_id}/",
    response_model=CalculationResponse,
    summary="Получение расчета по ID",
    description="Возвращает информацию о расчете по его идентификатору.",
    responses={
        200: {"description": "Расчет успешно получен"},
        404: {"description": "Расчет не найден"},
    },
)
# @IsAuthenticated
async def get_calculation(
    calculation_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Возвращает информацию о расчете по его идентификатору."""
    calculation = await get_calculation_by_id(db, calculation_id)
    if not calculation:
        raise NotFoundError("Расчет не найден")
    calc_dict = CalculationResponse.model_validate(calculation).model_dump()

    if calculation.equipment_data:
        equipment_list = []
        for eq_id in calculation.equipment_data:
            if isinstance(eq_id, dict):
                eq_id = eq_id.get("id", eq_id)
            equipment = await get_equipment_by_id(db, eq_id)
            if equipment:
                equipment_list.append(
                    EquipmentBrief.model_validate(equipment).model_dump()
                )
        calc_dict["equipment"] = equipment_list

    if hasattr(calculation, "sample") and calculation.sample:
        sample_dict = SampleResponse.model_validate(calculation.sample).model_dump()
        calc_dict["sample"] = sample_dict

    if hasattr(calculation, "research_method") and calculation.research_method:
        calc_dict["research_method"] = {
            "id": calculation.research_method.id,
            "name": calculation.research_method.name,
            "unit": calculation.research_method.unit,
        }

    return CalculationResponse(**calc_dict)


@router.patch(
    "/calculations/{calculation_id}/",
    response_model=CalculationResponse,
    summary="Обновление расчета",
    description=(
        "Обновляет существующий расчет. "
        "Можно обновить только указанные поля, остальные останутся без изменений."
    ),
    responses={
        200: {"description": "Расчет успешно обновлен"},
        404: {"description": "Расчет не найден"},
    },
)
# @IsAuthenticated
async def update_calculation_endpoint(
    calculation_id: int,
    calculation_data: CalculationUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Обновляет существующий расчет. Можно обновить только указанные поля."""
    calculation = await update_calculation(db, calculation_id, calculation_data)
    await db.commit()
    calc_dict = CalculationResponse.model_validate(calculation).model_dump()

    if calculation.equipment_data:
        equipment_list = []
        for eq_id in calculation.equipment_data:
            if isinstance(eq_id, dict):
                eq_id = eq_id.get("id", eq_id)
            equipment = await get_equipment_by_id(db, eq_id)
            if equipment:
                equipment_list.append(
                    EquipmentBrief.model_validate(equipment).model_dump()
                )
        calc_dict["equipment"] = equipment_list

    return CalculationResponse(**calc_dict)


@router.delete(
    "/calculations/{calculation_id}/",
    status_code=204,
    summary="Удаление расчета",
    description=(
        "Выполняет мягкое удаление расчета. "
        "Расчет не удаляется из базы данных, а помечается как удаленный."
    ),
    responses={
        204: {"description": "Расчет успешно удален"},
        404: {"description": "Расчет не найден"},
    },
)
# @IsAuthenticated
async def delete_calculation_endpoint(
    calculation_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Выполняет мягкое удаление расчета. Расчет не удаляется из базы данных, а помечается как удаленный."""
    await delete_calculation(db, calculation_id)
    await db.commit()


@router.post(
    "/calculate/",
    summary="Выполнение расчета",
    description=(
        "Выполняет расчет результата на основе входных данных и метода исследования. "
        "Возвращает результат расчета с промежуточными результатами, условиями повторяемости и погрешностью."
    ),
    responses={
        200: {"description": "Расчет успешно выполнен"},
        400: {"description": "Некорректные входные данные"},
        404: {"description": "Метод исследования не найден"},
    },
)
# @IsAuthenticated
async def calculate_endpoint(
    request: CalculateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Выполняет расчет результата на основе входных данных и метода исследования."""
    try:
        # Получаем метод исследования
        research_method_obj = await get_research_method_by_id(
            db, request.research_method_id
        )
        if not research_method_obj:
            raise NotFoundError("Метод исследования не найден")

        # Преобразуем объект метода в словарь для калькулятора
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
        }

        # Выполняем расчет
        result = await calculate_result(
            db=db,
            input_data=request.input_data,
            research_method=research_method,
        )

        return result

    except ValueError as e:
        raise ValidationError(str(e))
    except Exception as e:
        logger.error(f"Ошибка при расчете: {str(e)}", exc_info=True)
        raise ValidationError(f"Ошибка при расчете: {str(e)}")
