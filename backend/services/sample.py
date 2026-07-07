from __future__ import annotations
from decimal import Decimal
from typing import List, Optional
import pendulum
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import ConflictError, NotFoundError, ValidationError
from models.sample import MassFractionOilRefractionTable, Sample, SelectionConditions
from repositories import laboratory as laboratory_repo
from repositories import mass_fraction as mass_fraction_repo
from repositories import research as research_repo
from repositories import sample as sample_repo
from repositories import selection_conditions as selection_conditions_repo
from repositories.base import flush_entity
from schemas.sample import (
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
from services.employees import search_employees_by_fio
from services.protocol_sample_map import get_protocols_by_sample_ids
from services.visibility import validate_lab_and_department
from utils.pagination import calculate_total_pages


async def _resolve_added_by_hsnils(
    search_added_by: Optional[str],
) -> tuple[Optional[List[str]], bool]:
    """Поиск по ФИО добавившего в список hsnils."""
    if not search_added_by:
        return None, False

    normalized_added_by = search_added_by.strip()
    if not normalized_added_by:
        return None, False

    if len(normalized_added_by) < 3:
        return None, True

    employees = await search_employees_by_fio(normalized_added_by, include_photo=False)
    matching_hsnils = [
        employee.get("hsnils")
        for employee in employees
        if isinstance(employee, dict) and employee.get("hsnils")
    ]

    if matching_hsnils:
        return matching_hsnils, False
    return None, True


async def get_sample_by_id(
    db: AsyncSession, sample_id: int, include_deleted: bool = False
) -> Optional[Sample]:
    """Получить пробу по ID."""
    return await sample_repo.get_sample_by_id(db, sample_id, include_deleted)


async def get_samples(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    search: Optional[str] = None,
    search_sampling_location: Optional[str] = None,
    search_protocols: Optional[str] = None,
    search_added_by: Optional[str] = None,
    sample_type: Optional[str] = None,
    sample_types: Optional[List[str]] = None,
    test_object: Optional[str] = None,
    test_objects: Optional[List[str]] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
    sampling_date_from: Optional[pendulum.DateTime] = None,
    sampling_date_to: Optional[pendulum.DateTime] = None,
    receiving_date_from: Optional[pendulum.DateTime] = None,
    receiving_date_to: Optional[pendulum.DateTime] = None,
    created_at_from: Optional[pendulum.DateTime] = None,
    created_at_to: Optional[pendulum.DateTime] = None,
) -> tuple[List[Sample], int, int]:
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
    await validate_lab_and_department(
        db, sample_data.laboratory_id, sample_data.department_id
    )
    if sample_data.branch_id:
        if not await laboratory_repo.get_branch_by_id(db, sample_data.branch_id):
            raise NotFoundError("Филиал не найден")

    if sample_data.sampling_location_id:
        if not await laboratory_repo.get_sampling_location_by_id(
            db, sample_data.sampling_location_id
        ):
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


async def update_sample(
    db: AsyncSession, sample_id: int, sample_data: SampleUpdate
) -> Sample:
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
        lab_id = (
            sample_data.laboratory_id
            if sample_data.laboratory_id is not None
            else sample.laboratory_id
        )
        dept_id = (
            sample_data.department_id
            if sample_data.department_id is not None
            else sample.department_id
        )

        if dept_id:
            dept = await laboratory_repo.get_department_by_id(db, dept_id)
            if not dept:
                raise NotFoundError("Подразделение не найдено")
            if lab_id and dept.laboratory_id != lab_id:
                raise ValidationError(
                    "Подразделение должно принадлежать выбранной лаборатории"
                )

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

    for calc in await sample_repo.get_calculations_by_sample_id(db, sample_id):
        calc.soft_delete()

    sample.soft_delete()
    await flush_entity(db)


def build_sample_response(
    sample: Sample, protocols: list | None = None
) -> SampleResponse:
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


async def build_samples_list_response(
    db: AsyncSession, samples: list[Sample]
) -> list[SampleResponse]:
    """Собрать ответы API по списку проб с пакетной загрузкой протоколов."""
    sample_ids = [sample.id for sample in samples]
    protocols_by_sample = await get_protocols_by_sample_ids(db, sample_ids)
    return [
        build_sample_response(sample, protocols=protocols_by_sample.get(sample.id, []))
        for sample in samples
    ]


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
) -> Optional[SelectionConditions]:
    """Получить условия отбора по ID."""
    return await selection_conditions_repo.get_selection_conditions_by_id(
        db, conditions_id, include_deleted
    )


async def get_selection_conditions(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[List[SelectionConditions], int, int]:
    """Получить список условий отбора."""
    selection_conditions, total = (
        await selection_conditions_repo.get_selection_conditions(
            db, laboratory_id, department_id, page, page_size, sort_by, sort_order
        )
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
        raise ValidationError(
            "Условия отбора должны быть привязаны к лаборатории или подразделению"
        )

    if conditions_data.laboratory_id:
        if not await laboratory_repo.get_laboratory_by_id(
            db, conditions_data.laboratory_id
        ):
            raise NotFoundError("Лаборатория не найдена")

    if conditions_data.department_id:
        dept = await laboratory_repo.get_department_by_id(
            db, conditions_data.department_id
        )
        if not dept:
            raise NotFoundError("Подразделение не найдено")
        if (
            conditions_data.laboratory_id
            and dept.laboratory_id != conditions_data.laboratory_id
        ):
            raise ValidationError(
                "Подразделение должно принадлежать выбранной лаборатории"
            )

    selection_conditions = SelectionConditions(
        conditions=conditions_data.conditions,
        laboratory_id=conditions_data.laboratory_id,
        department_id=conditions_data.department_id,
    )
    return await selection_conditions_repo.add_selection_conditions(
        db, selection_conditions
    )


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

    if (
        conditions_data.laboratory_id is not None
        or conditions_data.department_id is not None
    ):
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
            raise ValidationError(
                "Условия отбора должны быть привязаны к лаборатории или подразделению"
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
    return selection_conditions


async def delete_selection_conditions(db: AsyncSession, conditions_id: int) -> None:
    """Удалить условия отбора (мягкое удаление)."""
    selection_conditions = await get_selection_conditions_by_id(db, conditions_id)
    if not selection_conditions:
        raise NotFoundError("Условия отбора не найдены")

    selection_conditions.soft_delete()
    await flush_entity(db)


async def get_selection_conditions_response_data(
    db: AsyncSession, conditions_id: int
) -> SelectionConditionsResponse:
    """Получить условия отбора с данными для ответа API."""
    conditions = await get_selection_conditions_by_id(db, conditions_id)
    if not conditions:
        raise NotFoundError("Условия отбора не найдены")
    return build_selection_conditions_response(conditions)


async def get_mass_fraction_table_response_data(
    db: AsyncSession, table_id: int
) -> MassFractionOilRefractionTableResponse:
    """Получить точку градуировочного графика с данными для ответа API."""
    table = await get_mass_fraction_oil_refraction_table_by_id(db, table_id)
    if not table:
        raise NotFoundError("Точка градуировочного графика не найдена")
    table_dict = MassFractionOilRefractionTableResponse.model_validate(
        table
    ).model_dump()
    if table.research_method:
        table_dict["research_method_name"] = table.research_method.name
    return MassFractionOilRefractionTableResponse(**table_dict)


async def get_mass_fraction_oil_refraction_table_by_id(
    db: AsyncSession, table_id: int, include_deleted: bool = False
) -> Optional[MassFractionOilRefractionTable]:
    """Получить точку градуировочного графика по ID."""
    return await mass_fraction_repo.get_mass_fraction_oil_refraction_table_by_id(
        db, table_id, include_deleted
    )


async def get_mass_fraction_oil_refraction_tables(
    db: AsyncSession,
    research_method_id: Optional[int] = None,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[List[MassFractionOilRefractionTable], int, int]:
    """Получить точки градуировочного графика."""
    tables, total = await mass_fraction_repo.get_mass_fraction_oil_refraction_tables(
        db, research_method_id, page, page_size, sort_by, sort_order
    )

    if page is not None and page_size is not None:
        total_pages = calculate_total_pages(total, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    return tables, total, total_pages


async def create_mass_fraction_oil_refraction_table(
    db: AsyncSession, table_data: MassFractionOilRefractionTableCreate
) -> MassFractionOilRefractionTable:
    """Создать точку градуировочного графика."""
    if not await research_repo.get_research_method_by_id(
        db, table_data.research_method_id
    ):
        raise NotFoundError("Метод исследования не найден")

    table = MassFractionOilRefractionTable(
        research_method_id=table_data.research_method_id,
        c_value=table_data.c_value,
        n_value=table_data.n_value,
    )
    return await mass_fraction_repo.add_mass_fraction_oil_refraction_table(db, table)


async def update_mass_fraction_oil_refraction_table(
    db: AsyncSession, table_id: int, table_data: MassFractionOilRefractionTableUpdate
) -> MassFractionOilRefractionTable:
    """Обновить точку градуировочного графика."""
    table = await get_mass_fraction_oil_refraction_table_by_id(db, table_id)
    if not table:
        raise NotFoundError("Точка градуировочного графика не найдена")

    update_data = table_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(table, key, value)

    await flush_entity(db)
    return table


async def get_registration_number_samples(
    db: AsyncSession,
    method_id: int,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
    search: Optional[str] = None,
) -> list[Sample]:
    """Получить пробы с расчётами по методу для автодополнения регистрационных номеров."""
    return await sample_repo.get_samples_with_calculations_by_method(
        db, method_id, laboratory_id, department_id, search
    )


async def delete_mass_fraction_oil_refraction_table(
    db: AsyncSession, table_id: int
) -> None:
    """Удалить точку градуировочного графика (мягкое удаление)."""
    table = await get_mass_fraction_oil_refraction_table_by_id(db, table_id)
    if not table:
        raise NotFoundError("Точка градуировочного графика не найдена")

    table.soft_delete()
    await flush_entity(db)


async def bulk_update_mass_fraction_oil_refraction_tables(
    db: AsyncSession, bulk_data: MassFractionOilRefractionTableBulkUpdate
) -> dict:
    """Массовое обновление градуировочного графика."""
    research_method_id = bulk_data.research_method_id
    new_entries = bulk_data.entries

    active_tables, _, _ = await get_mass_fraction_oil_refraction_tables(
        db, research_method_id=research_method_id
    )
    active_tables = [table for table in active_tables if not table.deleted_at]

    existing_entries_map = {}
    for entry in active_tables:
        key = (Decimal(str(entry.c_value)), Decimal(str(entry.n_value)))
        existing_entries_map[key] = entry

    new_entries_map = {}
    for entry in new_entries:
        c_value = Decimal(str(entry.get("c_value", 0)))
        n_value = Decimal(str(entry.get("n_value", 0)))
        key = (c_value, n_value)
        new_entries_map[key] = entry

    entries_to_deactivate = []
    entries_to_create = []

    for key, existing_entry in existing_entries_map.items():
        if key not in new_entries_map:
            entries_to_deactivate.append(existing_entry)

    for key, new_entry_data in new_entries_map.items():
        if key not in existing_entries_map:
            entries_to_create.append(new_entry_data)

    if not entries_to_deactivate and not entries_to_create:
        return {"message": "Изменений не обнаружено"}

    for entry in entries_to_deactivate:
        await delete_mass_fraction_oil_refraction_table(db, entry.id)

    created_count = 0
    for entry_data in entries_to_create:
        await create_mass_fraction_oil_refraction_table(
            db,
            MassFractionOilRefractionTableCreate(
                research_method_id=research_method_id,
                c_value=str(entry_data.get("c_value")),
                n_value=str(entry_data.get("n_value")),
            ),
        )
        created_count += 1

    return {
        "message": "Градуировочный график успешно обновлен",
        "created": created_count,
        "deactivated": len(entries_to_deactivate),
    }
