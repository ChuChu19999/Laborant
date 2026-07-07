from __future__ import annotations
from typing import List, Optional, get_args
from urllib.parse import quote
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from core.auth_decorators import IsAuthenticated
from core.deps import DbSession, SampleListFilters, ScopeSortPaginationParams
from core.exceptions import ValidationError
from schemas.pagination import PaginatedResponse
from schemas.sample import (
    SAMPLE_TYPE_CHOICES,
    MassFractionOilRefractionTableBulkUpdate,
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
from services.sample import (
    build_sample_response,
    build_samples_list_response,
    build_selection_conditions_response,
    bulk_update_mass_fraction_oil_refraction_tables,
    create_mass_fraction_oil_refraction_table,
    create_sample,
    create_selection_conditions,
    delete_mass_fraction_oil_refraction_table,
    delete_sample,
    delete_selection_conditions,
    get_mass_fraction_oil_refraction_tables,
    get_mass_fraction_table_response_data,
    get_registration_number_samples,
    get_sample_response_data,
    get_samples,
    get_selection_conditions,
    get_selection_conditions_response_data,
    update_mass_fraction_oil_refraction_table,
    update_sample,
    update_selection_conditions,
)
from services.samples_excel import build_samples_export_excel

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
    """Возвращает список доступных типов проб."""
    return list(get_args(SAMPLE_TYPE_CHOICES))


@router.get(
    "/samples/",
    response_model=PaginatedResponse[SampleResponse],
    summary="Получение списка проб",
    description=(
        "Возвращает список проб с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает фильтрацию по лабораториям и подразделениям, поиск и сортировку."
    ),
    responses={200: {"description": "Список проб успешно получен"}},
)
# @IsAuthenticated
async def list_samples(
    db: DbSession,
    filters: SampleListFilters = Depends(),
):
    """Возвращает список проб с пагинацией или без."""
    samples, total, total_pages = await get_samples(
        db,
        laboratory_id=filters.laboratory_id,
        department_id=filters.department_id,
        page=filters.page,
        page_size=filters.page_size,
        search=filters.search,
        search_sampling_location=filters.search_sampling_location,
        search_protocols=filters.search_protocols,
        search_added_by=filters.search_added_by,
        sample_type=filters.sample_type,
        sample_types=filters.sample_types,
        test_object=filters.test_object,
        test_objects=filters.test_objects,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
        sampling_date_from=filters.sampling_date_from,
        sampling_date_to=filters.sampling_date_to,
        receiving_date_from=filters.receiving_date_from,
        receiving_date_to=filters.receiving_date_to,
        created_at_from=filters.created_at_from,
        created_at_to=filters.created_at_to,
    )

    items = await build_samples_list_response(db, samples)

    return PaginatedResponse(
        items=items,
        total=total,
        page=filters.page if filters.page is not None else 1,
        page_size=filters.page_size if filters.page_size is not None else total,
        total_pages=total_pages,
    )


@router.get(
    "/samples/export/",
    summary="Формирование файла экспорта таблицы поступления проб",
    description=(
        "Формирует xlsx-файл со всеми пробами по текущим фильтрам и сортировке, "
        "включая расчеты и методы исследований."
    ),
    responses={
        200: {"description": "Файл Excel успешно сформирован"},
        400: {"description": "Нет данных для экспорта"},
    },
)
# @IsAuthenticated
async def export_samples(
    db: DbSession,
    filters: SampleListFilters = Depends(),
):
    """Формирует xlsx-файл таблицы поступления проб по текущим фильтрам и сортировке."""
    excel_bytes, total = await build_samples_export_excel(
        db,
        laboratory_id=filters.laboratory_id,
        department_id=filters.department_id,
        search=filters.search,
        search_sampling_location=filters.search_sampling_location,
        search_protocols=filters.search_protocols,
        search_added_by=filters.search_added_by,
        sample_type=filters.sample_type,
        sample_types=filters.sample_types,
        test_object=filters.test_object,
        test_objects=filters.test_objects,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
        sampling_date_from=filters.sampling_date_from,
        sampling_date_to=filters.sampling_date_to,
        receiving_date_from=filters.receiving_date_from,
        receiving_date_to=filters.receiving_date_to,
        created_at_from=filters.created_at_from,
        created_at_to=filters.created_at_to,
    )

    if total == 0 or not excel_bytes:
        raise ValidationError("Нет данных для экспорта по выбранным фильтрам")

    filename = "Поступления_проб.xlsx"
    encoded_filename = quote(filename, safe="")
    content_disposition = f"attachment; filename*=UTF-8''{encoded_filename}"

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": content_disposition,
            "X-Export-Total": str(total),
        },
    )


@router.post(
    "/samples/",
    response_model=SampleResponse,
    status_code=201,
    summary="Добавление новой пробы",
    description="Добавляет новую пробу на основе переданных данных.",
    responses={
        201: {"description": "Проба успешно добавлена"},
        400: {"description": "Некорректные данные для добавления пробы"},
    },
)
# @IsAuthenticated
async def create_sample_endpoint(
    sample_data: SampleCreate,
    db: DbSession,
):
    """Добавляет новую пробу на основе переданных данных."""
    sample = await create_sample(db, sample_data)
    return await get_sample_response_data(db, sample.id)


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
    db: DbSession,
):
    """Возвращает информацию о пробе по ее идентификатору."""
    return await get_sample_response_data(db, sample_id)


@router.patch(
    "/samples/{sample_id}/",
    response_model=SampleResponse,
    summary="Обновление пробы",
    description="Обновляет существующую пробу.",
    responses={
        200: {"description": "Проба успешно обновлена"},
        404: {"description": "Проба не найдена"},
    },
)
# @IsAuthenticated
async def update_sample_endpoint(
    sample_id: int,
    sample_data: SampleUpdate,
    db: DbSession,
):
    """Обновляет существующую пробу."""
    await update_sample(db, sample_id, sample_data)
    return await get_sample_response_data(db, sample_id)


@router.delete(
    "/samples/{sample_id}/",
    status_code=204,
    summary="Удаление пробы",
    description="Выполняет мягкое удаление пробы.",
    responses={
        204: {"description": "Проба успешно удалена"},
        404: {"description": "Проба не найдена"},
    },
)
# @IsAuthenticated
async def delete_sample_endpoint(
    sample_id: int,
    db: DbSession,
):
    """Выполняет мягкое удаление пробы."""
    await delete_sample(db, sample_id)


@router.get(
    "/get-registration-numbers/",
    response_model=dict,
    summary="Поиск регистрационных номеров проб по методу исследования",
    description=(
        "Возвращает список проб с расчетами по указанному методу исследования, "
        "которые соответствуют поисковому запросу. Используется для автодополнения "
        "при вводе регистрационного номера пробы."
    ),
    responses={200: {"description": "Список проб успешно получен"}},
)
# @IsAuthenticated
async def get_registration_numbers(
    db: DbSession,
    laboratory_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    method_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
):
    """Возвращает список проб с расчетами по указанному методу исследования."""
    if not method_id:
        return {"samples": []}

    samples = await get_registration_number_samples(
        db, method_id, laboratory_id, department_id, search
    )

    return {"samples": [build_sample_response(sample) for sample in samples]}


@router.get(
    "/selection-conditions/",
    response_model=PaginatedResponse[SelectionConditionsResponse],
    summary="Получение списка условий отбора",
    description=(
        "Возвращает список условий отбора с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает фильтрацию по лабораториям и подразделениям, сортировку."
    ),
    responses={200: {"description": "Список условий отбора успешно получен"}},
)
# @IsAuthenticated
async def list_selection_conditions(
    db: DbSession,
    params: ScopeSortPaginationParams = Depends(),
):
    """Возвращает список условий отбора с пагинацией или без."""
    conditions, total, total_pages = await get_selection_conditions(
        db,
        laboratory_id=params.laboratory_id,
        department_id=params.department_id,
        page=params.page,
        page_size=params.page_size,
        sort_by=params.sort_by,
        sort_order=params.sort_order,
    )

    items = [build_selection_conditions_response(condition) for condition in conditions]

    return PaginatedResponse(
        items=items,
        total=total,
        page=params.page if params.page is not None else 1,
        page_size=params.page_size if params.page_size is not None else total,
        total_pages=total_pages,
    )


@router.post(
    "/selection-conditions/",
    response_model=SelectionConditionsResponse,
    status_code=201,
    summary="Добавление условий отбора",
    description="Добавляет новые условия отбора на основе переданных данных.",
    responses={
        201: {"description": "Условия отбора успешно добавлены"},
        400: {"description": "Некорректные данные для добавления условий отбора"},
    },
)
# @IsAuthenticated
async def create_selection_conditions_endpoint(
    conditions_data: SelectionConditionsCreate,
    db: DbSession,
):
    """Добавляет новые условия отбора на основе переданных данных."""
    conditions = await create_selection_conditions(db, conditions_data)
    return await get_selection_conditions_response_data(db, conditions.id)


@router.patch(
    "/selection-conditions/{conditions_id}/",
    response_model=SelectionConditionsResponse,
    summary="Обновление условий отбора",
    description="Обновляет существующие условия отбора.",
    responses={
        200: {"description": "Условия отбора успешно обновлены"},
        404: {"description": "Условия отбора не найдены"},
    },
)
# @IsAuthenticated
async def update_selection_conditions_endpoint(
    conditions_id: int,
    conditions_data: SelectionConditionsUpdate,
    db: DbSession,
):
    """Обновляет существующие условия отбора."""
    await update_selection_conditions(db, conditions_id, conditions_data)
    return await get_selection_conditions_response_data(db, conditions_id)


@router.delete(
    "/selection-conditions/{conditions_id}/",
    status_code=204,
    summary="Удаление условий отбора",
    description="Выполняет мягкое удаление условий отбора.",
    responses={
        204: {"description": "Условия отбора успешно удалены"},
        404: {"description": "Условия отбора не найдены"},
    },
)
# @IsAuthenticated
async def delete_selection_conditions_endpoint(
    conditions_id: int,
    db: DbSession,
):
    """Выполняет мягкое удаление условий отбора."""
    await delete_selection_conditions(db, conditions_id)


@router.get(
    "/mass-fraction-oil-refraction-tables/",
    response_model=PaginatedResponse[MassFractionOilRefractionTableResponse],
    summary="Получение градуировочного графика",
    description=(
        "Возвращает точки градуировочного графика (массовая доля нефти C и показатель преломления n) "
        "с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает фильтрацию по методам исследования, сортировку."
    ),
    responses={200: {"description": "Градуировочный график успешно получен"}},
)
# @IsAuthenticated
async def list_mass_fraction_oil_refraction_tables(
    db: DbSession,
    research_method_id: Optional[int] = Query(None),
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
):
    """Возвращает точки градуировочного графика с пагинацией или без."""
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
        page=page if page is not None else 1,
        page_size=page_size if page_size is not None else total,
        total_pages=total_pages,
    )


@router.post(
    "/mass-fraction-oil-refraction-tables/",
    response_model=MassFractionOilRefractionTableResponse,
    status_code=201,
    summary="Добавление точки градуировочного графика",
    description="Добавляет новую точку градуировочного графика (пара C–n).",
    responses={
        201: {"description": "Точка градуировочного графика успешно добавлена"},
        400: {
            "description": "Некорректные данные для добавления точки градуировочного графика"
        },
    },
)
# @IsAuthenticated
async def create_mass_fraction_oil_refraction_table_endpoint(
    table_data: MassFractionOilRefractionTableCreate,
    db: DbSession,
):
    """Добавляет новую точку градуировочного графика."""
    table = await create_mass_fraction_oil_refraction_table(db, table_data)
    return await get_mass_fraction_table_response_data(db, table.id)


@router.patch(
    "/mass-fraction-oil-refraction-tables/{table_id}/",
    response_model=MassFractionOilRefractionTableResponse,
    summary="Обновление точки градуировочного графика",
    description="Обновляет существующую точку градуировочного графика.",
    responses={
        200: {"description": "Точка градуировочного графика успешно обновлена"},
        404: {"description": "Точка градуировочного графика не найдена"},
    },
)
# @IsAuthenticated
async def update_mass_fraction_oil_refraction_table_endpoint(
    table_id: int,
    table_data: MassFractionOilRefractionTableUpdate,
    db: DbSession,
):
    """Обновляет существующую точку градуировочного графика."""
    await update_mass_fraction_oil_refraction_table(db, table_id, table_data)
    return await get_mass_fraction_table_response_data(db, table_id)


@router.delete(
    "/mass-fraction-oil-refraction-tables/{table_id}/",
    status_code=204,
    summary="Удаление точки градуировочного графика",
    description="Выполняет мягкое удаление точки градуировочного графика.",
    responses={
        204: {"description": "Точка градуировочного графика успешно удалена"},
        404: {"description": "Точка градуировочного графика не найдена"},
    },
)
# @IsAuthenticated
async def delete_mass_fraction_oil_refraction_table_endpoint(
    table_id: int,
    db: DbSession,
):
    """Выполняет мягкое удаление точки градуировочного графика."""
    await delete_mass_fraction_oil_refraction_table(db, table_id)


@router.post(
    "/mass-fraction-oil-refraction-tables/bulk-update/",
    response_model=dict,
    status_code=200,
    summary="Массовое обновление градуировочного графика",
    description=(
        "Выполняет массовое обновление градуировочного графика. "
        "Помечает старые точки как неактивные и создаёт новые."
    ),
    responses={
        200: {"description": "Градуировочный график успешно обновлен"},
        400: {"description": "Некорректные данные для обновления"},
    },
)
# @IsAuthenticated
async def bulk_update_mass_fraction_oil_refraction_tables_endpoint(
    bulk_data: MassFractionOilRefractionTableBulkUpdate,
    db: DbSession,
):
    """Выполняет массовое обновление градуировочного графика."""
    return await bulk_update_mass_fraction_oil_refraction_tables(db, bulk_data)
