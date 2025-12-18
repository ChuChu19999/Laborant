from typing import List, Optional, get_args
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from core.database import get_db
from core.exceptions import NotFoundError
from core.security import IsAuthenticated
from models.sample import (
    MassFractionOilRefractionTable,
    Sample,
    SelectionConditions,
)
from schemas.pagination import PaginatedResponse
from schemas.sample import (
    SAMPLE_TYPE_CHOICES,
    MassFractionOilRefractionTableCreate,
    MassFractionOilRefractionTableResponse,
    MassFractionOilRefractionTableUpdate,
    SampleCreate,
    SampleResponse,
    SampleUpdate,
    SelectionConditionsCreate,
    SelectionConditionsResponse,
    SelectionConditionsUpdate,
)
from services.protocol import get_protocols_by_sample_ids
from services.sample import (
    create_mass_fraction_oil_refraction_table,
    create_sample,
    create_selection_conditions,
    delete_mass_fraction_oil_refraction_table,
    delete_sample,
    delete_selection_conditions,
    get_mass_fraction_oil_refraction_table_by_id,
    get_mass_fraction_oil_refraction_tables,
    get_sample_by_id,
    get_samples,
    get_selection_conditions,
    get_selection_conditions_by_id,
    update_mass_fraction_oil_refraction_table,
    update_sample,
    update_selection_conditions,
)
from utils.query_params import parse_date_range_params

router = APIRouter()


@router.get(
    "/sample-types/",
    response_model=List[str],
    summary="Получение списка типов проб",
    description="Возвращает список доступных типов проб.",
    responses={200: {"description": "Список типов проб успешно получен"}},
)
# @IsAuthenticated
async def get_sample_types():
    """
    Получить список типов проб.
    """
    return list(get_args(SAMPLE_TYPE_CHOICES))


@router.get(
    "/samples/",
    response_model=PaginatedResponse[SampleResponse],
    summary="Получение списка проб",
    description=(
        "Возвращает список проб с пагинацией. "
        "Поддерживает фильтрацию по лабораториям и подразделениям, поиск и сортировку."
    ),
    responses={200: {"description": "Список проб успешно получен"}},
)
# @IsAuthenticated
async def list_samples(
    laboratory_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    search_sampling_location: Optional[str] = Query(None),
    sample_type: Optional[str] = Query(None),
    sample_types: Optional[List[str]] = Query(None),
    test_object: Optional[str] = Query(None),
    test_objects: Optional[List[str]] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
    sampling_date_from: Optional[str] = Query(None),
    sampling_date_to: Optional[str] = Query(None),
    receiving_date_from: Optional[str] = Query(None),
    receiving_date_to: Optional[str] = Query(None),
    created_at_from: Optional[str] = Query(None),
    created_at_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Получить список проб с пагинацией.
    """
    sampling_date_from_parsed, sampling_date_to_parsed = parse_date_range_params(
        sampling_date_from, sampling_date_to
    )
    receiving_date_from_parsed, receiving_date_to_parsed = parse_date_range_params(
        receiving_date_from, receiving_date_to
    )
    created_at_from_parsed, created_at_to_parsed = parse_date_range_params(
        created_at_from, created_at_to
    )

    samples, total, total_pages = await get_samples(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        page=page,
        page_size=page_size,
        search=search,
        search_sampling_location=search_sampling_location,
        sample_type=sample_type,
        sample_types=sample_types,
        test_object=test_object,
        test_objects=test_objects,
        sort_by=sort_by,
        sort_order=sort_order,
        sampling_date_from=sampling_date_from_parsed,
        sampling_date_to=sampling_date_to_parsed,
        receiving_date_from=receiving_date_from_parsed,
        receiving_date_to=receiving_date_to_parsed,
        created_at_from=created_at_from_parsed,
        created_at_to=created_at_to_parsed,
    )

    sample_ids = [sample.id for sample in samples]
    protocols_by_sample = await get_protocols_by_sample_ids(db, sample_ids)

    items = []
    for sample in samples:
        sample_dict = SampleResponse.model_validate(sample).model_dump()
        if hasattr(sample, "laboratory") and sample.laboratory:
            sample_dict["laboratory_name"] = sample.laboratory.name
        if hasattr(sample, "department") and sample.department:
            sample_dict["department_name"] = sample.department.name
        if hasattr(sample, "branch") and sample.branch:
            sample_dict["branch_name"] = sample.branch.name
        if hasattr(sample, "sampling_location") and sample.sampling_location:
            sample_dict["sampling_location_name"] = sample.sampling_location.name
        sample_dict["protocols"] = protocols_by_sample.get(sample.id, [])
        items.append(SampleResponse(**sample_dict))

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "/samples/",
    response_model=SampleResponse,
    status_code=201,
    summary="Создание новой пробы",
    description="Создает новую пробу на основе переданных данных.",
    responses={
        201: {"description": "Проба успешно создана"},
        400: {"description": "Некорректные данные для создания пробы"},
    },
)
# @IsAuthenticated
async def create_sample_endpoint(
    sample_data: SampleCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Добавить пробу.

    Создает новую пробу на основе переданных данных.
    """
    sample = await create_sample(db, sample_data)
    await db.flush()
    await db.commit()

    result = await db.execute(
        select(Sample)
        .where(Sample.id == sample.id)
        .options(
            selectinload(Sample.laboratory),
            selectinload(Sample.department),
            selectinload(Sample.branch),
            selectinload(Sample.sampling_location),
        )
    )
    sample = result.scalar_one()
    sample_dict = SampleResponse.model_validate(sample).model_dump()
    if hasattr(sample, "laboratory") and sample.laboratory:
        sample_dict["laboratory_name"] = sample.laboratory.name
    if hasattr(sample, "department") and sample.department:
        sample_dict["department_name"] = sample.department.name
    if hasattr(sample, "branch") and sample.branch:
        sample_dict["branch_name"] = sample.branch.name
    if hasattr(sample, "sampling_location") and sample.sampling_location:
        sample_dict["sampling_location_name"] = sample.sampling_location.name
    return SampleResponse(**sample_dict)


@router.get(
    "/samples/{sample_id}/",
    response_model=SampleResponse,
    summary="Получение пробы по ID",
    description="Возвращает информацию о пробе по ее идентификатору.",
    responses={
        200: {"description": "Проба успешно получена"},
        404: {"description": "Проба не найдена"},
    },
)
# @IsAuthenticated
async def get_sample(
    sample_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Получить пробу по ID.
    """
    sample = await get_sample_by_id(db, sample_id)
    if not sample:
        raise NotFoundError("Проба не найдена")
    sample_dict = SampleResponse.model_validate(sample).model_dump()
    if hasattr(sample, "laboratory") and sample.laboratory:
        sample_dict["laboratory_name"] = sample.laboratory.name
    if hasattr(sample, "department") and sample.department:
        sample_dict["department_name"] = sample.department.name
    if hasattr(sample, "branch") and sample.branch:
        sample_dict["branch_name"] = sample.branch.name
    if hasattr(sample, "sampling_location") and sample.sampling_location:
        sample_dict["sampling_location_name"] = sample.sampling_location.name
    return SampleResponse(**sample_dict)


@router.patch(
    "/samples/{sample_id}/",
    response_model=SampleResponse,
    summary="Обновление пробы",
    description="Обновляет существующую пробу. Можно обновить только указанные поля.",
    responses={
        200: {"description": "Проба успешно обновлена"},
        404: {"description": "Проба не найдена"},
    },
)
# @IsAuthenticated
async def update_sample_endpoint(
    sample_id: int,
    sample_data: SampleUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Обновить пробу.

    Обновляет существующую пробу по ее идентификатору.
    """
    sample = await update_sample(db, sample_id, sample_data)
    await db.commit()

    result = await db.execute(
        select(Sample)
        .where(Sample.id == sample.id)
        .options(
            selectinload(Sample.laboratory),
            selectinload(Sample.department),
            selectinload(Sample.branch),
            selectinload(Sample.sampling_location),
        )
    )
    sample = result.scalar_one()
    sample_dict = SampleResponse.model_validate(sample).model_dump()
    if hasattr(sample, "laboratory") and sample.laboratory:
        sample_dict["laboratory_name"] = sample.laboratory.name
    if hasattr(sample, "department") and sample.department:
        sample_dict["department_name"] = sample.department.name
    if hasattr(sample, "branch") and sample.branch:
        sample_dict["branch_name"] = sample.branch.name
    if hasattr(sample, "sampling_location") and sample.sampling_location:
        sample_dict["sampling_location_name"] = sample.sampling_location.name
    return SampleResponse(**sample_dict)


@router.delete(
    "/samples/{sample_id}/",
    status_code=204,
    summary="Удаление пробы",
    description="Выполняет мягкое удаление пробы. Проба помечается как удаленная.",
    responses={
        204: {"description": "Проба успешно удалена"},
        404: {"description": "Проба не найдена"},
    },
)
# @IsAuthenticated
async def delete_sample_endpoint(
    sample_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Удалить пробу (мягкое удаление).

    Выполняет мягкое удаление пробы по ее идентификатору.
    """
    await delete_sample(db, sample_id)
    await db.commit()


@router.get(
    "/selection-conditions/",
    response_model=PaginatedResponse[SelectionConditionsResponse],
    summary="Получение списка условий отбора",
    description=(
        "Возвращает список условий отбора с пагинацией. "
        "Поддерживает фильтрацию по лабораториям и подразделениям, сортировку."
    ),
    responses={200: {"description": "Список условий отбора успешно получен"}},
)
# @IsAuthenticated
async def list_selection_conditions(
    laboratory_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
    db: AsyncSession = Depends(get_db),
):
    """
    Получить список условий отбора с пагинацией.
    """
    conditions, total, total_pages = await get_selection_conditions(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    items = []
    for condition in conditions:
        cond_dict = SelectionConditionsResponse.model_validate(condition).model_dump()
        if hasattr(condition, "laboratory") and condition.laboratory:
            cond_dict["laboratory_name"] = condition.laboratory.name
        if hasattr(condition, "department") and condition.department:
            cond_dict["department_name"] = condition.department.name
        items.append(SelectionConditionsResponse(**cond_dict))

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "/selection-conditions/",
    response_model=SelectionConditionsResponse,
    status_code=201,
    summary="Создание условий отбора",
    description="Создает новые условия отбора на основе переданных данных.",
    responses={
        201: {"description": "Условия отбора успешно созданы"},
        400: {"description": "Некорректные данные для создания условий отбора"},
    },
)
# @IsAuthenticated
async def create_selection_conditions_endpoint(
    conditions_data: SelectionConditionsCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Создать условия отбора.

    Создает новые условия отбора на основе переданных данных.
    """
    conditions = await create_selection_conditions(db, conditions_data)
    await db.commit()
    cond_dict = SelectionConditionsResponse.model_validate(conditions).model_dump()
    if hasattr(conditions, "laboratory") and conditions.laboratory:
        cond_dict["laboratory_name"] = conditions.laboratory.name
    if hasattr(conditions, "department") and conditions.department:
        cond_dict["department_name"] = conditions.department.name
    return SelectionConditionsResponse(**cond_dict)


@router.patch(
    "/selection-conditions/{conditions_id}/",
    response_model=SelectionConditionsResponse,
    summary="Обновление условий отбора",
    description="Обновляет существующие условия отбора. Можно обновить только указанные поля.",
    responses={
        200: {"description": "Условия отбора успешно обновлены"},
        404: {"description": "Условия отбора не найдены"},
    },
)
# @IsAuthenticated
async def update_selection_conditions_endpoint(
    conditions_id: int,
    conditions_data: SelectionConditionsUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Обновить условия отбора.

    Обновляет существующие условия отбора по их идентификатору.
    """
    conditions = await update_selection_conditions(db, conditions_id, conditions_data)
    await db.commit()

    result = await db.execute(
        select(SelectionConditions)
        .where(SelectionConditions.id == conditions.id)
        .options(
            selectinload(SelectionConditions.laboratory),
            selectinload(SelectionConditions.department),
        )
    )
    conditions = result.scalar_one()
    cond_dict = SelectionConditionsResponse.model_validate(conditions).model_dump()
    if hasattr(conditions, "laboratory") and conditions.laboratory:
        cond_dict["laboratory_name"] = conditions.laboratory.name
    if hasattr(conditions, "department") and conditions.department:
        cond_dict["department_name"] = conditions.department.name
    return SelectionConditionsResponse(**cond_dict)


@router.delete(
    "/selection-conditions/{conditions_id}/",
    status_code=204,
    summary="Удаление условий отбора",
    description="Выполняет мягкое удаление условий отбора. Условия помечаются как удаленные.",
    responses={
        204: {"description": "Условия отбора успешно удалены"},
        404: {"description": "Условия отбора не найдены"},
    },
)
# @IsAuthenticated
async def delete_selection_conditions_endpoint(
    conditions_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Удалить условия отбора (мягкое удаление).

    Выполняет мягкое удаление условий отбора по их идентификатору.
    """
    await delete_selection_conditions(db, conditions_id)
    await db.commit()


@router.get(
    "/mass-fraction-oil-refraction-tables/",
    response_model=PaginatedResponse[MassFractionOilRefractionTableResponse],
    summary="Получение списка таблиц соотношения C к n",
    description=(
        "Возвращает список таблиц соотношения массовой доли нефти к показателю преломления с пагинацией. "
        "Поддерживает фильтрацию по методам исследования, сортировку."
    ),
    responses={200: {"description": "Список таблиц успешно получен"}},
)
# @IsAuthenticated
async def list_mass_fraction_oil_refraction_tables(
    research_method_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
    db: AsyncSession = Depends(get_db),
):
    """
    Получить список таблиц соотношения C к n с пагинацией.
    """
    tables, total, total_pages = await get_mass_fraction_oil_refraction_tables(
        db,
        research_method_id=research_method_id,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    items = []
    for table in tables:
        table_dict = MassFractionOilRefractionTableResponse.model_validate(
            table
        ).model_dump()
        if hasattr(table, "research_method") and table.research_method:
            table_dict["research_method_name"] = table.research_method.name
        items.append(MassFractionOilRefractionTableResponse(**table_dict))

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "/mass-fraction-oil-refraction-tables/",
    response_model=MassFractionOilRefractionTableResponse,
    status_code=201,
    summary="Создание таблицы соотношения C к n",
    description="Создает новую таблицу соотношения массовой доли нефти к показателю преломления.",
    responses={
        201: {"description": "Таблица успешно создана"},
        400: {"description": "Некорректные данные для создания таблицы"},
    },
)
# @IsAuthenticated
async def create_mass_fraction_oil_refraction_table_endpoint(
    table_data: MassFractionOilRefractionTableCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Создать таблицу соотношения C к n.

    Создает новую таблицу соотношения массовой доли нефти к показателю преломления.
    """
    table = await create_mass_fraction_oil_refraction_table(db, table_data)
    await db.commit()
    table_dict = MassFractionOilRefractionTableResponse.model_validate(
        table
    ).model_dump()
    if hasattr(table, "research_method") and table.research_method:
        table_dict["research_method_name"] = table.research_method.name
    return MassFractionOilRefractionTableResponse(**table_dict)


@router.patch(
    "/mass-fraction-oil-refraction-tables/{table_id}/",
    response_model=MassFractionOilRefractionTableResponse,
    summary="Обновление таблицы соотношения C к n",
    description="Обновляет существующую таблицу. Можно обновить только указанные поля.",
    responses={
        200: {"description": "Таблица успешно обновлена"},
        404: {"description": "Таблица не найдена"},
    },
)
# @IsAuthenticated
async def update_mass_fraction_oil_refraction_table_endpoint(
    table_id: int,
    table_data: MassFractionOilRefractionTableUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Обновить таблицу соотношения C к n.

    Обновляет существующую таблицу по ее идентификатору.
    """
    table = await update_mass_fraction_oil_refraction_table(db, table_id, table_data)
    await db.commit()

    result = await db.execute(
        select(MassFractionOilRefractionTable)
        .where(MassFractionOilRefractionTable.id == table.id)
        .options(selectinload(MassFractionOilRefractionTable.research_method))
    )
    table = result.scalar_one()
    table_dict = MassFractionOilRefractionTableResponse.model_validate(
        table
    ).model_dump()
    if hasattr(table, "research_method") and table.research_method:
        table_dict["research_method_name"] = table.research_method.name
    return MassFractionOilRefractionTableResponse(**table_dict)


@router.delete(
    "/mass-fraction-oil-refraction-tables/{table_id}/",
    status_code=204,
    summary="Удаление таблицы соотношения C к n",
    description="Выполняет мягкое удаление таблицы. Таблица помечается как удаленная.",
    responses={
        204: {"description": "Таблица успешно удалена"},
        404: {"description": "Таблица не найдена"},
    },
)
# @IsAuthenticated
async def delete_mass_fraction_oil_refraction_table_endpoint(
    table_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Удалить таблицу соотношения C к n (мягкое удаление).

    Выполняет мягкое удаление таблицы по ее идентификатору.
    """
    await delete_mass_fraction_oil_refraction_table(db, table_id)
    await db.commit()
