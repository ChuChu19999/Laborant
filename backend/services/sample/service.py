from __future__ import annotations
from typing import get_args
import pendulum
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import (
    ConflictError,
    NotFoundError,
    ServiceUnavailableError,
)
from core.logger import logger
from models.sample import Sample
from repositories import (
    calculation as calculation_repo,
    sample as sample_repo,
)
from repositories.base import flush_entity
from schemas.sample import (
    SAMPLE_TYPE_CHOICES,
    RegistrationNumbersResponse,
    SampleCreate,
    SampleProtocolSummary,
    SampleResponse,
    SampleUpdate,
)
from services.branch import require_branch_by_id
from services.employee import search_employees_by_fio
from services.protocol.sample_map import get_protocols_by_sample_ids
from services.sampling_location import require_sampling_location_by_id
from services.visibility import validate_lab_and_department


def get_sample_type_choices() -> list[str]:
    """Вернуть список допустимых типов проб для API."""
    return list(get_args(SAMPLE_TYPE_CHOICES))


async def _resolve_added_by_hsnils(
    search_added_by: str | None,
) -> tuple[list[str] | None, bool]:
    """Свести поиск по ФИО добавившего к списку hsnils."""
    if not search_added_by:
        return None, False

    normalized_added_by = search_added_by.strip()
    if not normalized_added_by:
        return None, False

    if len(normalized_added_by) < 3:
        return None, True

    try:
        employees = await search_employees_by_fio(normalized_added_by, include_photo=False)
    except ServiceUnavailableError:
        # HR недоступен: список проб не валить, фильтр по добавившему пропустить.
        logger.warning(
            "HR недоступен при фильтре added_by=%r, фильтр пропущен",
            normalized_added_by,
        )
        return None, False

    matching_hsnils: list[str] = []
    for employee in employees:
        if isinstance(employee.hsnils, str):
            matching_hsnils.append(employee.hsnils)

    if matching_hsnils:
        return matching_hsnils, False
    return None, True


async def get_sample_by_id(db: AsyncSession, sample_id: int, include_deleted: bool = False) -> Sample | None:
    """Получить пробу по ID."""
    return await sample_repo.get_sample_by_id(db, sample_id, include_deleted)


async def require_sample_by_id(db: AsyncSession, sample_id: int, include_deleted: bool = False) -> Sample:
    """Вернуть пробу по ID, иначе вызвать NotFoundError."""
    sample = await get_sample_by_id(db, sample_id, include_deleted)
    if not sample:
        raise NotFoundError("Проба не найдена")
    return sample


async def get_samples(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    page: int | None = None,
    page_size: int | None = None,
    search: str | None = None,
    search_sampling_location: str | None = None,
    search_protocols: str | None = None,
    search_added_by: str | None = None,
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
) -> tuple[list[SampleResponse], int]:
    """Получить список проб."""
    added_by_hsnils, no_added_by_match = await _resolve_added_by_hsnils(search_added_by)

    samples, total = await sample_repo.get_samples(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        page=page,
        page_size=page_size,
        search=search,
        search_sampling_location=search_sampling_location,
        search_protocols=search_protocols,
        added_by_hsnils=added_by_hsnils,
        no_added_by_match=no_added_by_match,
        sample_type=sample_type,
        sample_types=sample_types,
        test_object=test_object,
        test_objects=test_objects,
        sort_by=sort_by,
        sort_order=sort_order,
        sampling_date_from=sampling_date_from,
        sampling_date_to=sampling_date_to,
        receiving_date_from=receiving_date_from,
        receiving_date_to=receiving_date_to,
        created_at_from=created_at_from,
        created_at_to=created_at_to,
    )

    protocols_by_sample = await get_protocols_by_sample_ids(db, [sample.id for sample in samples])
    return (
        [build_sample_response(sample, protocols=protocols_by_sample.get(sample.id, [])) for sample in samples],
        total,
    )


def build_sample_response(
    sample: Sample,
    *,
    protocols: list[SampleProtocolSummary] | None = None,
) -> SampleResponse:
    """Собрать SampleResponse из ORM-пробы и опционального списка протоколов."""
    response = SampleResponse.model_validate(sample)
    if protocols is None:
        return response
    return response.model_copy(update={"protocols": protocols})


async def create_sample(db: AsyncSession, sample_data: SampleCreate) -> Sample:
    """Добавить пробу."""
    await validate_lab_and_department(db, sample_data.laboratory_id, sample_data.department_id)

    branch_obj = None
    if sample_data.branch_id is not None:
        branch_obj = await require_branch_by_id(db, sample_data.branch_id)

    if sample_data.sampling_location_id is not None:
        await require_sampling_location_by_id(db, sample_data.sampling_location_id)

    if await sample_repo.exists_sample_by_registration(
        db,
        sample_data.registration_number,
        sample_data.laboratory_id,
        sample_data.department_id,
    ):
        raise ConflictError(
            "Проба с таким регистрационным номером уже существует для данной лаборатории и подразделения"
        )

    sample = Sample(
        registration_number=sample_data.registration_number,
        sample_type=sample_data.sample_type,
        test_object=sample_data.test_object,
        sampling_date=sample_data.sampling_date,
        receiving_date=sample_data.receiving_date,
        laboratory_id=sample_data.laboratory_id,
        department_id=sample_data.department_id,
        branch_id=sample_data.branch_id,
        sampling_location_id=sample_data.sampling_location_id,
        well=sample_data.well,
        mode=sample_data.mode,
        indicators_count=sample_data.indicators_count,
        phone=sample_data.phone,
        selection_conditions=sample_data.selection_conditions,
        added_by=sample_data.added_by,
    )

    if branch_obj is not None and branch_obj.phone:
        sample.phone = branch_obj.phone

    await sample_repo.add_sample(db, sample)
    return await require_sample_by_id(db, sample.id)


async def update_sample(db: AsyncSession, sample: Sample, sample_data: SampleUpdate) -> Sample:
    """Обновить пробу."""
    update_data = sample_data.model_dump(exclude_unset=True)
    update_data.pop("added_by", None)

    branch_obj = None
    if "branch_id" in update_data and update_data["branch_id"] is not None:
        branch_obj = await require_branch_by_id(db, update_data["branch_id"])

    if "sampling_location_id" in update_data and update_data["sampling_location_id"] is not None:
        await require_sampling_location_by_id(db, update_data["sampling_location_id"])

    if update_data.get("registration_number"):
        lab_id = update_data.get("laboratory_id", sample.laboratory_id)
        dept_id = update_data.get("department_id", sample.department_id)
        if await sample_repo.exists_sample_by_registration(
            db,
            str(update_data["registration_number"]).strip(),
            lab_id,
            dept_id,
            exclude_id=sample.id,
        ):
            raise ConflictError(
                "Проба с таким регистрационным номером уже существует для данной лаборатории и подразделения"
            )

    for key, value in update_data.items():
        setattr(sample, key, value)

    if sample_data.laboratory_id is not None or sample_data.department_id is not None:
        lab_id = sample_data.laboratory_id if sample_data.laboratory_id is not None else sample.laboratory_id
        dept_id = sample_data.department_id if sample_data.department_id is not None else sample.department_id
        await validate_lab_and_department(db, lab_id, dept_id)

    if sample.branch_id is not None:
        if branch_obj is None or branch_obj.id != sample.branch_id:
            branch_obj = await require_branch_by_id(db, sample.branch_id)
        if branch_obj.phone:
            sample.phone = branch_obj.phone

    await flush_entity(db)
    return await require_sample_by_id(db, sample.id)


async def delete_sample(db: AsyncSession, sample: Sample) -> None:
    """Мягко удалить пробу вместе с её расчётами."""
    for calc in await calculation_repo.get_calculations_by_sample(db, sample_id=sample.id):
        calc.soft_delete()

    sample.soft_delete()
    await flush_entity(db)


async def get_registration_number_samples(
    db: AsyncSession,
    method_id: int,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    search: str | None = None,
) -> list[Sample]:
    """Получить пробы с расчётами по методу для автодополнения регистрационных номеров."""
    return await sample_repo.get_samples_by_research_method(db, method_id, laboratory_id, department_id, search)


async def get_registration_numbers_response(
    db: AsyncSession,
    method_id: int | None,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    search: str | None = None,
) -> RegistrationNumbersResponse:
    """Собрать ответ для пикера регистрационных номеров; без method_id — пустой список."""
    if not method_id:
        return RegistrationNumbersResponse(samples=[])
    samples = await get_registration_number_samples(
        db,
        method_id,
        laboratory_id,
        department_id,
        search,
    )
    return RegistrationNumbersResponse(
        samples=[build_sample_response(sample) for sample in samples],
    )
