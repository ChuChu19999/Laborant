from __future__ import annotations
import pendulum
from sqlalchemy import ColumnElement, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.calculation import Calculation
from models.sample import Sample
from models.sampling_location import SamplingLocation
from repositories.base import (
    add_and_flush,
    execute_exists,
    execute_scalar_one_or_none,
    execute_scalars_all,
    filter_not_deleted,
    filter_not_deleted_unless,
)
from utils.filters import add_date_range_filter
from utils.pagination import apply_pagination, get_total_count
from utils.protocol.search_filter import sample_has_protocol_display_ilike
from utils.sample.display_rules import WELL_DISPLAY_PREFIX
from utils.sample.sort import (
    protocols_sort_scalar_subquery,
    registration_number_sort_columns,
)
from utils.sorting import build_order_by


def _sampling_location_display_expr():
    """SQL-выражение отображаемой строки места отбора (имя + скважина + режим)."""
    well_part = case(
        (Sample.well.isnot(None), func.concat(WELL_DISPLAY_PREFIX, Sample.well)),
        else_="",
    )
    return func.concat(
        func.coalesce(SamplingLocation.name, ""),
        " ",
        well_part,
        " ",
        func.coalesce(Sample.mode, ""),
    )


def _build_sample_conditions(
    *,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    search: str | None = None,
    search_protocols: str | None = None,
    added_by_hsnils: list[str] | None = None,
    no_added_by_match: bool = False,
    sample_type: str | None = None,
    sample_types: list[str] | None = None,
    test_object: str | None = None,
    test_objects: list[str] | None = None,
    search_sampling_location: str | None = None,
    sampling_date_from: pendulum.DateTime | None = None,
    sampling_date_to: pendulum.DateTime | None = None,
    receiving_date_from: pendulum.DateTime | None = None,
    receiving_date_to: pendulum.DateTime | None = None,
    created_at_from: pendulum.DateTime | None = None,
    created_at_to: pendulum.DateTime | None = None,
) -> list[ColumnElement[bool]]:
    """Собрать условия фильтрации проб."""
    conditions: list[ColumnElement[bool]] = []
    if laboratory_id:
        conditions.append(Sample.laboratory_id == laboratory_id)
    if department_id:
        conditions.append(Sample.department_id == department_id)
    if search:
        conditions.append(Sample.registration_number.ilike(f"%{search}%"))

    if search_protocols and search_protocols.strip():
        conditions.append(sample_has_protocol_display_ilike(search_protocols))

    if no_added_by_match:
        conditions.append(Sample.id == -1)
    elif added_by_hsnils:
        conditions.append(Sample.added_by.in_(added_by_hsnils))

    if sample_types:
        conditions.append(Sample.sample_type.in_(sample_types))
    elif sample_type:
        conditions.append(Sample.sample_type == sample_type)
    if test_objects:
        conditions.append(Sample.test_object.in_(test_objects))
    elif test_object:
        conditions.append(Sample.test_object == test_object)

    if search_sampling_location:
        sampling_location_search = search_sampling_location.lower()
        conditions.append(func.lower(_sampling_location_display_expr()).ilike(f"%{sampling_location_search}%"))

    add_date_range_filter(conditions, sampling_date_from, sampling_date_to, Sample.sampling_date)
    add_date_range_filter(conditions, receiving_date_from, receiving_date_to, Sample.receiving_date)
    add_date_range_filter(conditions, created_at_from, created_at_to, Sample.created_at)
    return conditions


async def get_sample_by_id(db: AsyncSession, sample_id: int, include_deleted: bool = False) -> Sample | None:
    """Получить пробу по ID."""
    query = (
        select(Sample)
        .where(Sample.id == sample_id)
        .options(
            selectinload(Sample.laboratory),
            selectinload(Sample.department),
            selectinload(Sample.branch),
            selectinload(Sample.sampling_location),
        )
    )
    query = filter_not_deleted_unless(query, Sample.deleted_at, include_deleted)
    return await execute_scalar_one_or_none(db, query)


async def get_samples_by_ids(db: AsyncSession, sample_ids: list[int]) -> list[Sample]:
    """Получить пробы по списку ID."""
    query = (
        select(Sample)
        .where(Sample.id.in_(sample_ids))
        .options(
            selectinload(Sample.laboratory),
            selectinload(Sample.department),
            selectinload(Sample.branch),
            selectinload(Sample.sampling_location),
        )
    )
    query = filter_not_deleted(query, Sample.deleted_at)
    return await execute_scalars_all(db, query)


async def get_sample_ids_by_registration_search(db: AsyncSession, search_samples: str) -> list[int]:
    """Найти ID проб по регистрационному номеру."""
    query = filter_not_deleted(
        select(Sample.id).where(
            Sample.registration_number.ilike(f"%{search_samples}%"),
        ),
        Sample.deleted_at,
    )
    return await execute_scalars_all(db, query)


async def get_samples(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    page: int | None = None,
    page_size: int | None = None,
    search: str | None = None,
    search_sampling_location: str | None = None,
    search_protocols: str | None = None,
    added_by_hsnils: list[str] | None = None,
    no_added_by_match: bool = False,
    sample_type: str | None = None,
    sample_types: list[str] | None = None,
    test_object: str | None = None,
    test_objects: list[str] | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
    sampling_date_from: pendulum.DateTime | None = None,
    sampling_date_to: pendulum.DateTime | None = None,
    receiving_date_from: pendulum.DateTime | None = None,
    receiving_date_to: pendulum.DateTime | None = None,
    created_at_from: pendulum.DateTime | None = None,
    created_at_to: pendulum.DateTime | None = None,
) -> tuple[list[Sample], int]:
    """Получить список проб."""
    query = filter_not_deleted(select(Sample), Sample.deleted_at).options(
        selectinload(Sample.laboratory),
        selectinload(Sample.department),
        selectinload(Sample.branch),
        selectinload(Sample.sampling_location),
    )

    needs_sampling_location_join = bool(search_sampling_location) or sort_by == "sampling_location"
    if needs_sampling_location_join:
        query = query.join(
            SamplingLocation,
            Sample.sampling_location_id == SamplingLocation.id,
            isouter=True,
        )

    conditions = _build_sample_conditions(
        laboratory_id=laboratory_id,
        department_id=department_id,
        search=search,
        search_protocols=search_protocols,
        added_by_hsnils=added_by_hsnils,
        no_added_by_match=no_added_by_match,
        sample_type=sample_type,
        sample_types=sample_types,
        test_object=test_object,
        test_objects=test_objects,
        search_sampling_location=search_sampling_location,
        sampling_date_from=sampling_date_from,
        sampling_date_to=sampling_date_to,
        receiving_date_from=receiving_date_from,
        receiving_date_to=receiving_date_to,
        created_at_from=created_at_from,
        created_at_to=created_at_to,
    )
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "sample_type": Sample.sample_type,
        "test_object": Sample.test_object,
        "sampling_date": Sample.sampling_date,
        "receiving_date": Sample.receiving_date,
        "created_at": Sample.created_at,
    }

    if sort_by == "sampling_location":
        sampling_location_sort = _sampling_location_display_expr()
        if sort_order == "asc":
            query = query.order_by(sampling_location_sort.asc())
        else:
            query = query.order_by(sampling_location_sort.desc())
    elif sort_by == "registration_number":
        reg_num, reg_year = registration_number_sort_columns()
        if sort_order == "asc":
            query = query.order_by(reg_num.asc(), reg_year.asc(), Sample.id.asc())
        else:
            query = query.order_by(reg_num.desc(), reg_year.desc(), Sample.id.desc())
    elif sort_by == "protocols":
        protocol_sort = protocols_sort_scalar_subquery()
        if sort_order == "asc":
            query = query.order_by(protocol_sort.asc().nulls_last(), Sample.id.asc())
        else:
            query = query.order_by(protocol_sort.desc().nulls_first(), Sample.id.desc())
    else:
        order_by = build_order_by(sort_by, sort_order, sort_mapping, Sample.created_at)
        query = query.order_by(order_by)

    count_query = filter_not_deleted(select(func.count()).select_from(Sample), Sample.deleted_at)
    if search_sampling_location:
        count_query = count_query.join(
            SamplingLocation,
            Sample.sampling_location_id == SamplingLocation.id,
            isouter=True,
        )
    if conditions:
        count_query = count_query.where(*conditions)

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        query = apply_pagination(query, page, page_size)

    samples = await execute_scalars_all(db, query)
    return samples, total


async def exists_sample_by_registration(
    db: AsyncSession,
    registration_number: str,
    laboratory_id: int,
    department_id: int | None,
    exclude_id: int | None = None,
) -> bool:
    """Проверить существование пробы с таким регистрационным номером."""
    query = filter_not_deleted(
        select(Sample.id).where(
            Sample.registration_number == registration_number,
            Sample.laboratory_id == laboratory_id,
            Sample.department_id == department_id,
        ),
        Sample.deleted_at,
    )
    if exclude_id is not None:
        query = query.where(Sample.id != exclude_id)
    return await execute_exists(db, query)


async def add_sample(db: AsyncSession, sample: Sample) -> Sample:
    """Добавить пробу."""
    await add_and_flush(db, sample)
    return sample


async def get_samples_by_research_method(
    db: AsyncSession,
    method_id: int,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    search: str | None = None,
) -> list[Sample]:
    """Получить пробы с расчётом по указанному методу (для пикера)."""
    subquery = filter_not_deleted(
        select(Sample.id)
        .join(Calculation, Sample.id == Calculation.sample_id)
        .where(Calculation.research_method_id == method_id),
        Calculation.deleted_at,
    )
    subquery = filter_not_deleted(subquery, Sample.deleted_at).distinct()

    conditions = []
    if laboratory_id:
        conditions.append(Sample.laboratory_id == laboratory_id)
    if department_id:
        conditions.append(Sample.department_id == department_id)
    if search:
        conditions.append(Sample.registration_number.ilike(f"%{search}%"))

    if conditions:
        subquery = subquery.where(*conditions)

    subquery = subquery.limit(10)

    query = (
        select(Sample)
        .where(Sample.id.in_(subquery))
        .options(
            selectinload(Sample.laboratory),
            selectinload(Sample.department),
            selectinload(Sample.branch),
            selectinload(Sample.sampling_location),
        )
    )

    return await execute_scalars_all(db, query)


async def get_samples_by_receiving_date_range(
    db: AsyncSession,
    laboratory_id: int,
    receiving_date_from: pendulum.DateTime | None,
    receiving_date_to: pendulum.DateTime | None,
    department_id: int | None = None,
) -> list[Sample]:
    """Пробы за период по дате получения с branch и sampling_location."""
    query = filter_not_deleted(
        select(Sample).where(Sample.laboratory_id == laboratory_id),
        Sample.deleted_at,
    )
    conditions: list = []
    add_date_range_filter(conditions, receiving_date_from, receiving_date_to, Sample.receiving_date)
    if department_id is not None:
        conditions.append(Sample.department_id == department_id)
    if conditions:
        query = query.where(*conditions)

    query = query.options(
        selectinload(Sample.branch),
        selectinload(Sample.sampling_location),
    )
    return await execute_scalars_all(db, query)


async def get_samples_by_sampling_date_range(
    db: AsyncSession,
    laboratory_id: int,
    sampling_date_from: pendulum.DateTime,
    sampling_date_to: pendulum.DateTime,
    department_id: int | None = None,
) -> list[Sample]:
    """Пробы за период по дате отбора."""
    query = filter_not_deleted(
        select(Sample).where(Sample.laboratory_id == laboratory_id),
        Sample.deleted_at,
    )
    conditions: list = []
    add_date_range_filter(conditions, sampling_date_from, sampling_date_to, Sample.sampling_date)
    if department_id is not None:
        conditions.append(Sample.department_id == department_id)
    if conditions:
        query = query.where(*conditions)
    return await execute_scalars_all(db, query)


async def get_nks_samples_by_sampling_date_range(
    db: AsyncSession,
    laboratory_id: int,
    sampling_date_from: pendulum.DateTime,
    sampling_date_to: pendulum.DateTime,
    department_id: int | None = None,
) -> list[Sample]:
    """Пробы для отчёта НКС за период по дате отбора."""
    query = filter_not_deleted(
        select(Sample).where(
            Sample.laboratory_id == laboratory_id,
            Sample.test_object.ilike("%нефтеконденсатная смесь%"),
        ),
        Sample.deleted_at,
    )
    conditions: list = []
    add_date_range_filter(conditions, sampling_date_from, sampling_date_to, Sample.sampling_date)
    if department_id is not None:
        conditions.append(Sample.department_id == department_id)
    if conditions:
        query = query.where(*conditions)
    return await execute_scalars_all(db, query)


async def get_oil_samples_by_sampling_location_name(
    db: AsyncSession,
    laboratory_id: int,
    sampling_location_db_name: str,
    sampling_date_from: pendulum.DateTime,
    sampling_date_to: pendulum.DateTime,
    department_id: int | None = None,
) -> list[Sample]:
    """Получить пробы нефти для физико-химического отчёта со скважиной и местом отбора."""
    query = filter_not_deleted(
        select(Sample)
        .join(
            SamplingLocation,
            Sample.sampling_location_id == SamplingLocation.id,
        )
        .where(
            Sample.laboratory_id == laboratory_id,
            Sample.sampling_location_id.isnot(None),
            SamplingLocation.name == sampling_location_db_name,
            func.nullif(func.trim(Sample.well), "").isnot(None),
            Sample.test_object.ilike("%нефть%"),
            ~Sample.test_object.ilike("%калибровочн%"),
        ),
        Sample.deleted_at,
    )
    query = filter_not_deleted(query, SamplingLocation.deleted_at)
    conditions: list = []
    add_date_range_filter(conditions, sampling_date_from, sampling_date_to, Sample.sampling_date)
    if department_id is not None:
        conditions.append(Sample.department_id == department_id)
    if conditions:
        query = query.where(*conditions)

    query = query.options(selectinload(Sample.sampling_location))
    return await execute_scalars_all(db, query)


async def get_kgs_candidate_samples(
    db: AsyncSession,
    laboratory_id: int,
    sampling_date_from: pendulum.DateTime,
    sampling_date_to: pendulum.DateTime,
    department_id: int | None = None,
) -> list[Sample]:
    """Пробы для отчёта КГС: паспортизация, дегазированный конденсат, с местом отбора."""
    query = filter_not_deleted(
        select(Sample)
        .join(
            SamplingLocation,
            Sample.sampling_location_id == SamplingLocation.id,
        )
        .where(
            Sample.laboratory_id == laboratory_id,
            Sample.sampling_location_id.isnot(None),
            Sample.sample_type == "Паспортизация",
            Sample.test_object.ilike("%дегазированный конденсат%"),
        ),
        Sample.deleted_at,
    )
    query = filter_not_deleted(query, SamplingLocation.deleted_at)
    conditions: list = []
    add_date_range_filter(conditions, sampling_date_from, sampling_date_to, Sample.sampling_date)
    if department_id is not None:
        conditions.append(Sample.department_id == department_id)
    if conditions:
        query = query.where(*conditions)

    query = query.options(selectinload(Sample.sampling_location))
    return await execute_scalars_all(db, query)
