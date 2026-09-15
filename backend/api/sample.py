from __future__ import annotations
from typing import Annotated
from fastapi import APIRouter, Depends
from core.deps import (
    DbSession,
    RegistrationNumbersFiltersDep,
    SampleListFiltersDep,
    UserPermissions,
)
from core.responses import build_attachment_response
from schemas.pagination import PaginatedResponse, build_paginated_response
from schemas.sample import (
    RegistrationNumbersResponse,
    SampleCreate,
    SampleResponse,
    SampleUpdate,
)
from services.access_control import enforce_nav_access, enforce_samples_mutation
from services.sample.excel import (
    SamplesExportPrepared,
    build_samples_export_file,
    prepare_samples_export_excel,
)
from services.sample.service import (
    create_sample,
    delete_sample,
    get_registration_numbers_response,
    get_samples,
    require_sample_by_id,
    update_sample,
)

router = APIRouter()


async def _samples_export_prepared(
    db: DbSession,
    effective: UserPermissions,
    filters: SampleListFiltersDep,
):
    enforce_nav_access(effective, "samples", filters.laboratory_id, filters.department_id)
    return await prepare_samples_export_excel(
        db,
        laboratory_id=filters.laboratory_id,
        department_id=filters.department_id,
        search=filters.search,
        search_sampling_location=filters.search_sampling_location,
        search_protocols=filters.search_protocols,
        search_added_by=filters.search_added_by,
        sample_type=None,
        sample_types=filters.sample_types_list,
        test_object=None,
        test_objects=filters.test_objects_list,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
        sampling_date_from=filters.sampling_date_from,
        sampling_date_to=filters.sampling_date_to,
        receiving_date_from=filters.receiving_date_from,
        receiving_date_to=filters.receiving_date_to,
        created_at_from=filters.created_at_from,
        created_at_to=filters.created_at_to,
    )


@router.get(
    "/samples/",
    response_model=PaginatedResponse[SampleResponse],
    summary="Получение списка проб",
    description=(
        "Возвращает список проб с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает фильтрацию по лабораториям и подразделениям, поиск и сортировку."
    ),
    responses={
        200: {"description": "Список проб успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def list_samples(
    db: DbSession,
    effective: UserPermissions,
    filters: SampleListFiltersDep,
):
    enforce_nav_access(effective, "samples", filters.laboratory_id, filters.department_id)
    samples, total = await get_samples(
        db,
        laboratory_id=filters.laboratory_id,
        department_id=filters.department_id,
        page=filters.page,
        page_size=filters.page_size,
        search=filters.search,
        search_sampling_location=filters.search_sampling_location,
        search_protocols=filters.search_protocols,
        search_added_by=filters.search_added_by,
        sample_type=None,
        sample_types=filters.sample_types_list,
        test_object=None,
        test_objects=filters.test_objects_list,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
        sampling_date_from=filters.sampling_date_from,
        sampling_date_to=filters.sampling_date_to,
        receiving_date_from=filters.receiving_date_from,
        receiving_date_to=filters.receiving_date_to,
        created_at_from=filters.created_at_from,
        created_at_to=filters.created_at_to,
    )
    return build_paginated_response(samples, total, filters.page, filters.page_size)


@router.get(
    "/samples/export/",
    summary="Формирование файла экспорта таблицы поступления проб",
    description=(
        "Формирует xlsx-файл со всеми пробами по текущим фильтрам и сортировке, включая расчёты и методы исследований."
    ),
    responses={
        200: {"description": "Файл Excel успешно сформирован"},
        400: {"description": "Нет данных для экспорта"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def export_samples(
    prepared: Annotated[SamplesExportPrepared, Depends(_samples_export_prepared)],
):
    excel_bytes, filename = build_samples_export_file(prepared)
    return build_attachment_response(
        excel_bytes,
        filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extra_headers={"X-Export-Total": str(prepared.total)},
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
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def create_sample_endpoint(
    sample_data: SampleCreate,
    db: DbSession,
    effective: UserPermissions,
):
    enforce_nav_access(effective, "samples", sample_data.laboratory_id, sample_data.department_id)
    return await create_sample(db, sample_data)


@router.get(
    "/get-registration-numbers/",
    response_model=RegistrationNumbersResponse,
    summary="Поиск регистрационных номеров проб по методу исследования",
    description=(
        "Возвращает список проб с расчётами по указанному методу исследования, "
        "которые соответствуют поисковому запросу. Используется для автодополнения "
        "при вводе регистрационного номера пробы."
    ),
    responses={
        200: {"description": "Список проб успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
@router.get(
    "/samples/registration-numbers/",
    response_model=RegistrationNumbersResponse,
    summary="Поиск регистрационных номеров проб по методу исследования",
    description=(
        "Возвращает список проб с расчётами по указанному методу исследования, "
        "которые соответствуют поисковому запросу. Используется для автодополнения "
        "при вводе регистрационного номера пробы."
    ),
    responses={
        200: {"description": "Список проб успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def get_registration_numbers(
    db: DbSession,
    effective: UserPermissions,
    filters: RegistrationNumbersFiltersDep,
) -> RegistrationNumbersResponse:
    enforce_nav_access(effective, "samples", filters.laboratory_id, filters.department_id)
    return await get_registration_numbers_response(
        db,
        filters.method_id,
        filters.laboratory_id,
        filters.department_id,
        filters.search,
    )


@router.get(
    "/samples/{sample_id:int}/",
    response_model=SampleResponse,
    summary="Получение пробы по ID",
    description="Возвращает информацию о пробе по её идентификатору.",
    responses={
        200: {"description": "Проба успешно получена"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Проба не найдена"},
    },
)
# @IsAuthenticated
async def get_sample(
    sample_id: int,
    db: DbSession,
    effective: UserPermissions,
):
    sample = await require_sample_by_id(db, sample_id)
    enforce_nav_access(effective, "samples", sample.laboratory_id, sample.department_id)
    return sample


@router.patch(
    "/samples/{sample_id:int}/",
    response_model=SampleResponse,
    summary="Обновление пробы",
    description="Обновляет существующую пробу.",
    responses={
        200: {"description": "Проба успешно обновлена"},
        403: {"description": "Отказано в доступе"},
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
    sample = await require_sample_by_id(db, sample_id)
    enforce_samples_mutation(effective, "update", sample.laboratory_id, sample.department_id)
    return await update_sample(db, sample, sample_data)


@router.delete(
    "/samples/{sample_id:int}/",
    status_code=204,
    summary="Удаление пробы",
    description="Выполняет мягкое удаление пробы.",
    responses={
        204: {"description": "Проба успешно удалена"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Проба не найдена"},
    },
)
# @IsAuthenticated
async def delete_sample_endpoint(
    sample_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> None:
    sample = await require_sample_by_id(db, sample_id)
    enforce_samples_mutation(effective, "delete", sample.laboratory_id, sample.department_id)
    await delete_sample(db, sample)
