from __future__ import annotations
from typing import get_args
from fastapi import APIRouter, Depends, Query
from core.deps import DbSession, SampleListFilters, UserPermissions
from core.exceptions import ValidationError
from core.responses import build_attachment_response
from schemas.pagination import PaginatedResponse
from schemas.sample import (
    SAMPLE_TYPE_CHOICES,
    SampleCreate,
    SampleResponse,
    SampleUpdate,
)
from services.access_control import enforce_nav_access, enforce_samples_mutation
from services.sample import (
    build_sample_response,
    build_samples_list_response,
    create_sample,
    delete_sample,
    get_registration_number_samples,
    get_sample_response_data,
    get_samples,
    require_sample_by_id,
    update_sample,
)
from services.samples_excel import build_samples_export_excel

router = APIRouter()


@router.get(
    "/sample-types/",
    response_model=list[str],
    summary="Получение списка типов проб",
    description="Возвращает список доступных типов проб.",
    responses={200: {"description": "Список типов проб успешно получен"}},
)
# @IsAuthenticated
async def get_sample_types(effective: UserPermissions):
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
    effective: UserPermissions,
    filters: SampleListFilters = Depends(),
):
    """Возвращает список проб с пагинацией или без."""
    enforce_nav_access(effective, "samples", filters.laboratory_id, filters.department_id)
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
        "Формирует xlsx-файл со всеми пробами по текущим фильтрам и сортировке, включая расчеты и методы исследований."
    ),
    responses={
        200: {"description": "Файл Excel успешно сформирован"},
        400: {"description": "Нет данных для экспорта"},
    },
)
# @IsAuthenticated
async def export_samples(
    db: DbSession,
    effective: UserPermissions,
    filters: SampleListFilters = Depends(),
):
    """Формирует xlsx-файл таблицы поступления проб по текущим фильтрам и сортировке."""
    enforce_nav_access(effective, "samples", filters.laboratory_id, filters.department_id)
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
    return build_attachment_response(
        excel_bytes,
        filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extra_headers={"X-Export-Total": str(total)},
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
    effective: UserPermissions,
):
    """Добавляет новую пробу на основе переданных данных."""
    enforce_nav_access(effective, "samples", sample_data.laboratory_id, sample_data.department_id)
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
    effective: UserPermissions,
):
    """Возвращает информацию о пробе по ее идентификатору."""
    sample = await require_sample_by_id(db, sample_id)
    enforce_nav_access(effective, "samples", sample.laboratory_id, sample.department_id)
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
    effective: UserPermissions,
):
    """Обновляет существующую пробу."""
    sample = await require_sample_by_id(db, sample_id)
    enforce_samples_mutation(effective, "update", sample.laboratory_id, sample.department_id)
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
    effective: UserPermissions,
):
    """Выполняет мягкое удаление пробы."""
    sample = await require_sample_by_id(db, sample_id)
    enforce_samples_mutation(effective, "delete", sample.laboratory_id, sample.department_id)
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
    effective: UserPermissions,
    laboratory_id: int | None = Query(None),
    department_id: int | None = Query(None),
    method_id: int | None = Query(None),
    search: str | None = Query(None),
):
    """Возвращает список проб с расчетами по указанному методу исследования."""
    enforce_nav_access(effective, "samples", laboratory_id, department_id)
    if not method_id:
        return {"samples": []}

    samples = await get_registration_number_samples(db, method_id, laboratory_id, department_id, search)

    return {"samples": [build_sample_response(sample) for sample in samples]}
