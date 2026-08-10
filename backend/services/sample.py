from __future__ import annotations
import pendulum
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import (
    ConflictError,
    NotFoundError,
    ServiceUnavailableError,
    ValidationError,
)
from core.logger import logger
from models.sample import Sample, SelectionConditions
from repositories import (
    calculation as calculation_repo,
    laboratory as laboratory_repo,
    sample as sample_repo,
    selection_conditions as selection_conditions_repo,
)
from repositories.base import flush_entity
from schemas.sample import (
    SampleCreate,
    SampleResponse,
    SampleUpdate,
    SelectionConditionsCreate,
    SelectionConditionsResponse,
    SelectionConditionsUpdate,
)
from services.employees import search_employees_by_fio
from services.protocol_sample_map import get_protocols_by_sample_ids
from services.visibility import validate_lab_and_department
from utils.pagination import calculate_total_pages


async def _resolve_added_by_hsnils(
    search_added_by: str | None,
) -> tuple[list[str] | None, bool]:
    """Поиск по ФИО добавившего в список hsnils."""
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
        # HR недоступен: список проб не валим, фильтр по добавившему пропускаем.
        logger.warning(
            "HR недоступен при фильтре added_by=%r, фильтр пропущен",
            normalized_added_by,
        )
        return None, False

    matching_hsnils = [
        employee.get("hsnils") for employee in employees if isinstance(employee, dict) and employee.get("hsnils")
    ]

    if matching_hsnils:
        return matching_hsnils, False
    return None, True


async def get_sample_by_id(db: AsyncSession, sample_id: int, include_deleted: bool = False) -> Sample | None:
    """Получить пробу по ID."""
    return await sample_repo.get_sample_by_id(db, sample_id, include_deleted)


async def require_sample_by_id(db: AsyncSession, sample_id: int, include_deleted: bool = False) -> Sample:
    """Получить пробу по ID или вернуть 404."""
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
) -> tuple[list[Sample], int, int]:
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

    if page is not None and page_size is not None:
        total_pages = calculate_total_pages(total, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    return samples, total, total_pages


async def create_sample(db: AsyncSession, sample_data: SampleCreate) -> Sample:
    """Добавить пробу."""
    await validate_lab_and_department(db, sample_data.laboratory_id, sample_data.department_id)
    if sample_data.branch_id:
        if not await laboratory_repo.get_branch_by_id(db, sample_data.branch_id):
            raise NotFoundError("Филиал не найден")

    if sample_data.sampling_location_id:
        if not await laboratory_repo.get_sampling_location_by_id(db, sample_data.sampling_location_id):
            raise NotFoundError("Место отбора пробы не найдено")

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

    if sample.branch_id:
        branch_obj = await laboratory_repo.get_branch_by_id(db, sample.branch_id)
        if branch_obj and branch_obj.phone:
            sample.phone = branch_obj.phone

    return await sample_repo.add_sample(db, sample)


async def update_sample(db: AsyncSession, sample_id: int, sample_data: SampleUpdate) -> Sample:
    """Обновить пробу."""
    sample = await get_sample_by_id(db, sample_id)
    if not sample:
        raise NotFoundError("Проба не найдена")

    update_data = sample_data.model_dump(exclude_unset=True)
    update_data.pop("added_by", None)
    for key, value in update_data.items():
        if key == "registration_number" and value:
            if await sample_repo.exists_sample_by_registration(
                db,
                value.strip(),
                sample_data.laboratory_id or sample.laboratory_id,
                sample_data.department_id or sample.department_id,
                exclude_id=sample_id,
            ):
                raise ConflictError(
                    "Проба с таким регистрационным номером уже существует для данной лаборатории и подразделения"
                )
        setattr(sample, key, value)

    if sample_data.laboratory_id is not None or sample_data.department_id is not None:
        lab_id = sample_data.laboratory_id if sample_data.laboratory_id is not None else sample.laboratory_id
        dept_id = sample_data.department_id if sample_data.department_id is not None else sample.department_id

        await validate_lab_and_department(db, lab_id, dept_id)

    if sample.branch_id:
        branch_obj = await laboratory_repo.get_branch_by_id(db, sample.branch_id)
        if branch_obj and branch_obj.phone:
            sample.phone = branch_obj.phone

    await flush_entity(db)
    return sample


async def delete_sample(db: AsyncSession, sample_id: int) -> None:
    """Удалить пробу (мягкое удаление)."""
    sample = await get_sample_by_id(db, sample_id)
    if not sample:
        raise NotFoundError("Проба не найдена")

    for calc in await calculation_repo.get_calculations_by_sample(db, sample_id=sample_id):
        calc.soft_delete()

    sample.soft_delete()
    await flush_entity(db)


def build_sample_response(sample: Sample, protocols: list | None = None) -> SampleResponse:
    """Собрать ответ API по пробе с наименованиями связей."""
    sample_dict = SampleResponse.model_validate(sample).model_dump()
    if sample.laboratory:
        sample_dict["laboratory_name"] = sample.laboratory.name
    if sample.department:
        sample_dict["department_name"] = sample.department.name
    if sample.branch:
        sample_dict["branch_name"] = sample.branch.name
    if sample.sampling_location:
        sample_dict["sampling_location_name"] = sample.sampling_location.name
    if protocols is not None:
        sample_dict["protocols"] = protocols
    return SampleResponse(**sample_dict)


async def build_samples_list_response(db: AsyncSession, samples: list[Sample]) -> list[SampleResponse]:
    """Собрать ответы API по списку проб с пакетной загрузкой протоколов."""
    sample_ids = [sample.id for sample in samples]
    protocols_by_sample = await get_protocols_by_sample_ids(db, sample_ids)
    return [build_sample_response(sample, protocols=protocols_by_sample.get(sample.id, [])) for sample in samples]


def build_selection_conditions_response(
    conditions: SelectionConditions,
) -> SelectionConditionsResponse:
    """Собрать ответ API по условиям отбора с наименованиями связей."""
    cond_dict = SelectionConditionsResponse.model_validate(conditions).model_dump()
    if conditions.laboratory:
        cond_dict["laboratory_name"] = conditions.laboratory.name
    if conditions.department:
        cond_dict["department_name"] = conditions.department.name
    return SelectionConditionsResponse(**cond_dict)


async def get_sample_response_data(db: AsyncSession, sample_id: int) -> SampleResponse:
    """Получить пробу с данными для ответа API."""
    sample = await get_sample_by_id(db, sample_id)
    if not sample:
        raise NotFoundError("Проба не найдена")
    return build_sample_response(sample)


async def get_selection_conditions_by_id(
    db: AsyncSession, conditions_id: int, include_deleted: bool = False
) -> SelectionConditions | None:
    """Получить условия отбора по ID."""
    return await selection_conditions_repo.get_selection_conditions_by_id(db, conditions_id, include_deleted)


async def require_selection_conditions_by_id(
    db: AsyncSession, conditions_id: int, include_deleted: bool = False
) -> SelectionConditions:
    """Получить условия отбора по ID или вернуть 404."""
    conditions = await get_selection_conditions_by_id(db, conditions_id, include_deleted)
    if not conditions:
        raise NotFoundError("Условия отбора не найдены")
    return conditions


async def get_selection_conditions(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    page: int | None = None,
    page_size: int | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[SelectionConditions], int, int]:
    """Получить список условий отбора."""
    selection_conditions, total = await selection_conditions_repo.get_selection_conditions(
        db, laboratory_id, department_id, page, page_size, sort_by, sort_order
    )

    if page is not None and page_size is not None:
        total_pages = calculate_total_pages(total, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    return selection_conditions, total, total_pages


async def create_selection_conditions(
    db: AsyncSession, conditions_data: SelectionConditionsCreate
) -> SelectionConditions:
    """Создать условия отбора."""
    if not conditions_data.laboratory_id and not conditions_data.department_id:
        raise ValidationError("Условия отбора должны быть привязаны к лаборатории или подразделению")

    if conditions_data.laboratory_id:
        if not await laboratory_repo.get_laboratory_by_id(db, conditions_data.laboratory_id):
            raise NotFoundError("Лаборатория не найдена")

    if conditions_data.department_id:
        dept = await laboratory_repo.get_department_by_id(db, conditions_data.department_id)
        if not dept:
            raise NotFoundError("Подразделение не найдено")
        if conditions_data.laboratory_id and dept.laboratory_id != conditions_data.laboratory_id:
            raise ValidationError("Подразделение должно принадлежать выбранной лаборатории")

    selection_conditions = SelectionConditions(
        conditions=conditions_data.conditions,
        laboratory_id=conditions_data.laboratory_id,
        department_id=conditions_data.department_id,
    )
    return await selection_conditions_repo.add_selection_conditions(db, selection_conditions)


async def update_selection_conditions(
    db: AsyncSession, conditions_id: int, conditions_data: SelectionConditionsUpdate
) -> SelectionConditions:
    """Обновить условия отбора."""
    selection_conditions = await get_selection_conditions_by_id(db, conditions_id)
    if not selection_conditions:
        raise NotFoundError("Условия отбора не найдены")

    update_data = conditions_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(selection_conditions, key, value)

    if conditions_data.laboratory_id is not None or conditions_data.department_id is not None:
        lab_id = (
            conditions_data.laboratory_id
            if conditions_data.laboratory_id is not None
            else selection_conditions.laboratory_id
        )
        dept_id = (
            conditions_data.department_id
            if conditions_data.department_id is not None
            else selection_conditions.department_id
        )

        if not lab_id and not dept_id:
            raise ValidationError("Условия отбора должны быть привязаны к лаборатории или подразделению")

        if dept_id:
            dept = await laboratory_repo.get_department_by_id(db, dept_id)
            if not dept:
                raise NotFoundError("Подразделение не найдено")
            if lab_id and dept.laboratory_id != lab_id:
                raise ValidationError("Подразделение должно принадлежать выбранной лаборатории")

    await flush_entity(db)
    return selection_conditions


async def delete_selection_conditions(db: AsyncSession, conditions_id: int) -> None:
    """Удалить условия отбора (мягкое удаление)."""
    selection_conditions = await get_selection_conditions_by_id(db, conditions_id)
    if not selection_conditions:
        raise NotFoundError("Условия отбора не найдены")

    selection_conditions.soft_delete()
    await flush_entity(db)


async def get_selection_conditions_response_data(db: AsyncSession, conditions_id: int) -> SelectionConditionsResponse:
    """Получить условия отбора с данными для ответа API."""
    conditions = await get_selection_conditions_by_id(db, conditions_id)
    if not conditions:
        raise NotFoundError("Условия отбора не найдены")
    return build_selection_conditions_response(conditions)


async def get_registration_number_samples(
    db: AsyncSession,
    method_id: int,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    search: str | None = None,
) -> list[Sample]:
    """Получить пробы с расчётами по методу для автодополнения регистрационных номеров."""
    return await sample_repo.get_samples_with_calculations_by_method(
        db, method_id, laboratory_id, department_id, search
    )
