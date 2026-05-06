from typing import Any, Dict, List, Optional
import pendulum
from sqlalchemy import Float, case, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from core.exceptions import ConflictError, NotFoundError, ValidationError
from models.calculation import Calculation
from models.laboratory import Branch, Department, Laboratory, SamplingLocation
from models.research import ResearchMethod
from models.sample import MassFractionOilRefractionTable, Sample, SelectionConditions
from schemas.sample import (
    MassFractionOilRefractionTableCreate,
    MassFractionOilRefractionTableUpdate,
    SampleCreate,
    SampleUpdate,
    SelectionConditionsCreate,
    SelectionConditionsUpdate,
)
from services.employees import search_employees_by_fio
from utils.filters import add_date_range_filter, add_text_search_filter
from utils.pagination import apply_pagination, calculate_total_pages, get_total_count
from utils.protocol_search_filter import sample_has_protocol_display_ilike
from utils.sample_sort import (
    protocols_sort_scalar_subquery,
    registration_number_sort_columns,
)
from utils.sorting import build_order_by


async def get_sample_by_id(
    db: AsyncSession, sample_id: int, include_deleted: bool = False
) -> Optional[Sample]:
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
    if not include_deleted:
        query = query.where(Sample.deleted_at.is_(None))
    result = await db.execute(query)
    return result.scalar_one_or_none()


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
    query = (
        select(Sample)
        .where(Sample.deleted_at.is_(None))
        .options(
            selectinload(Sample.laboratory),
            selectinload(Sample.department),
            selectinload(Sample.branch),
            selectinload(Sample.sampling_location),
        )
    )

    conditions = []
    if laboratory_id:
        conditions.append(Sample.laboratory_id == laboratory_id)
    if department_id:
        conditions.append(Sample.department_id == department_id)
    if search:
        conditions.append(Sample.registration_number.ilike(f"%{search}%"))

    if search_protocols and search_protocols.strip():
        conditions.append(sample_has_protocol_display_ilike(search_protocols))

    if search_added_by:
        normalized_added_by = search_added_by.strip()
        if normalized_added_by:
            matching_hashes = []
            if len(normalized_added_by) >= 3:
                employees = await search_employees_by_fio(
                    normalized_added_by, include_photo=False
                )
                matching_hashes = [
                    employee.get("hashMd5")
                    for employee in employees
                    if isinstance(employee, dict) and employee.get("hashMd5")
                ]

            if matching_hashes:
                conditions.append(Sample.added_by.in_(matching_hashes))
            else:
                conditions.append(Sample.id == -1)

    if sample_types:
        conditions.append(Sample.sample_type.in_(sample_types))
    elif sample_type:
        conditions.append(Sample.sample_type == sample_type)
    if test_objects:
        conditions.append(Sample.test_object.in_(test_objects))
    elif test_object:
        conditions.append(Sample.test_object == test_object)

    needs_sampling_location_join = (
        search_sampling_location or sort_by == "sampling_location"
    )
    if needs_sampling_location_join:
        query = query.join(
            SamplingLocation,
            Sample.sampling_location_id == SamplingLocation.id,
            isouter=True,
        )

    if search_sampling_location:
        sampling_location_search = search_sampling_location.lower()
        well_part = case(
            (Sample.well.isnot(None), func.concat("скв. ", Sample.well)), else_=""
        )
        sampling_location_text = func.concat(
            func.coalesce(SamplingLocation.name, ""),
            " ",
            well_part,
            " ",
            func.coalesce(Sample.mode, ""),
        )
        conditions.append(
            func.lower(sampling_location_text).ilike(f"%{sampling_location_search}%")
        )

    add_date_range_filter(
        conditions, sampling_date_from, sampling_date_to, Sample.sampling_date
    )
    add_date_range_filter(
        conditions, receiving_date_from, receiving_date_to, Sample.receiving_date
    )
    add_date_range_filter(conditions, created_at_from, created_at_to, Sample.created_at)

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
        well_part = case(
            (Sample.well.isnot(None), func.concat("скв. ", Sample.well)), else_=""
        )
        sampling_location_sort = func.concat(
            func.coalesce(SamplingLocation.name, ""),
            " ",
            well_part,
            " ",
            func.coalesce(Sample.mode, ""),
        )
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

    count_query = (
        select(func.count()).select_from(Sample).where(Sample.deleted_at.is_(None))
    )
    count_conditions = []
    if laboratory_id:
        count_conditions.append(Sample.laboratory_id == laboratory_id)
    if department_id:
        count_conditions.append(Sample.department_id == department_id)
    if search:
        count_conditions.append(Sample.registration_number.ilike(f"%{search}%"))

    if search_protocols and search_protocols.strip():
        count_conditions.append(sample_has_protocol_display_ilike(search_protocols))

    if search_added_by:
        normalized_added_by = search_added_by.strip()
        if normalized_added_by:
            matching_hashes = []
            if len(normalized_added_by) >= 3:
                employees = await search_employees_by_fio(
                    normalized_added_by, include_photo=False
                )
                matching_hashes = [
                    employee.get("hashMd5")
                    for employee in employees
                    if isinstance(employee, dict) and employee.get("hashMd5")
                ]

            if matching_hashes:
                count_conditions.append(Sample.added_by.in_(matching_hashes))
            else:
                count_conditions.append(Sample.id == -1)

    if sample_types:
        count_conditions.append(Sample.sample_type.in_(sample_types))
    elif sample_type:
        count_conditions.append(Sample.sample_type == sample_type)
    if test_objects:
        count_conditions.append(Sample.test_object.in_(test_objects))
    elif test_object:
        count_conditions.append(Sample.test_object == test_object)

    if search_sampling_location:
        sampling_location_search = search_sampling_location.lower()
        count_query = count_query.join(
            SamplingLocation,
            Sample.sampling_location_id == SamplingLocation.id,
            isouter=True,
        )
        well_part = case(
            (Sample.well.isnot(None), func.concat("скв. ", Sample.well)), else_=""
        )
        sampling_location_text = func.concat(
            func.coalesce(SamplingLocation.name, ""),
            " ",
            well_part,
            " ",
            func.coalesce(Sample.mode, ""),
        )
        count_conditions.append(
            func.lower(sampling_location_text).ilike(f"%{sampling_location_search}%")
        )

    add_date_range_filter(
        count_conditions, sampling_date_from, sampling_date_to, Sample.sampling_date
    )
    add_date_range_filter(
        count_conditions, receiving_date_from, receiving_date_to, Sample.receiving_date
    )
    add_date_range_filter(
        count_conditions, created_at_from, created_at_to, Sample.created_at
    )

    if count_conditions:
        count_query = count_query.where(*count_conditions)

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        total_pages = calculate_total_pages(total, page_size)
        query = apply_pagination(query, page, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    result = await db.execute(query)
    samples = result.scalars().all()

    return samples, total, total_pages


async def create_sample(db: AsyncSession, sample_data: SampleCreate) -> Sample:
    """Добавить пробу."""
    laboratory = await db.execute(
        select(Laboratory).where(Laboratory.id == sample_data.laboratory_id)
    )
    if not laboratory.scalar_one_or_none():
        raise NotFoundError("Лаборатория не найдена")

    if sample_data.department_id:
        department = await db.execute(
            select(Department).where(Department.id == sample_data.department_id)
        )
        dept = department.scalar_one_or_none()
        if not dept:
            raise NotFoundError("Подразделение не найдено")
        if dept.laboratory_id != sample_data.laboratory_id:
            raise ValidationError(
                "Подразделение должно принадлежать выбранной лаборатории"
            )

    if sample_data.branch_id:
        branch = await db.execute(
            select(Branch).where(Branch.id == sample_data.branch_id)
        )
        if not branch.scalar_one_or_none():
            raise NotFoundError("Филиал не найден")

    if sample_data.sampling_location_id:
        sampling_location = await db.execute(
            select(SamplingLocation).where(
                SamplingLocation.id == sample_data.sampling_location_id
            )
        )
        if not sampling_location.scalar_one_or_none():
            raise NotFoundError("Место отбора пробы не найдено")

    existing = await db.execute(
        select(Sample).where(
            Sample.registration_number == sample_data.registration_number,
            Sample.laboratory_id == sample_data.laboratory_id,
            Sample.department_id == sample_data.department_id,
            Sample.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none():
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
        phone=sample_data.phone,
        selection_conditions=sample_data.selection_conditions,
        added_by=sample_data.added_by,
    )

    if sample.branch_id:
        branch_result = await db.execute(
            select(Branch).where(Branch.id == sample.branch_id)
        )
        branch_obj = branch_result.scalar_one()
        if branch_obj.phone:
            sample.phone = branch_obj.phone

    db.add(sample)
    await db.flush()
    return sample


async def update_sample(
    db: AsyncSession, sample_id: int, sample_data: SampleUpdate
) -> Sample:
    """Обновить пробу."""
    sample = await get_sample_by_id(db, sample_id)
    if not sample:
        raise NotFoundError("Проба не найдена")

    update_data = sample_data.model_dump(exclude_unset=True)
    # Исключаем added_by из обновления, так как это поле нельзя изменять
    update_data.pop("added_by", None)
    for key, value in update_data.items():
        if key == "registration_number" and value:
            existing = await db.execute(
                select(Sample).where(
                    Sample.registration_number == value.strip(),
                    Sample.laboratory_id
                    == (sample_data.laboratory_id or sample.laboratory_id),
                    Sample.department_id
                    == (sample_data.department_id or sample.department_id),
                    Sample.id != sample_id,
                    Sample.deleted_at.is_(None),
                )
            )
            if existing.scalar_one_or_none():
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
            department = await db.execute(
                select(Department).where(Department.id == dept_id)
            )
            dept = department.scalar_one_or_none()
            if not dept:
                raise NotFoundError("Подразделение не найдено")
            if lab_id and dept.laboratory_id != lab_id:
                raise ValidationError(
                    "Подразделение должно принадлежать выбранной лаборатории"
                )

    if sample.branch_id:
        branch_result = await db.execute(
            select(Branch).where(Branch.id == sample.branch_id)
        )
        branch_obj = branch_result.scalar_one()
        if branch_obj.phone:
            sample.phone = branch_obj.phone

    await db.flush()
    return sample


async def delete_sample(db: AsyncSession, sample_id: int) -> None:
    """Удалить пробу (мягкое удаление)."""
    sample = await get_sample_by_id(db, sample_id)
    if not sample:
        raise NotFoundError("Проба не найдена")

    calculations = await db.execute(
        select(Calculation).where(
            Calculation.sample_id == sample_id, Calculation.deleted_at.is_(None)
        )
    )
    for calc in calculations.scalars().all():
        calc.soft_delete()

    sample.soft_delete()
    await db.flush()


async def get_selection_conditions_by_id(
    db: AsyncSession, conditions_id: int, include_deleted: bool = False
) -> Optional[SelectionConditions]:
    """Получить условия отбора по ID."""
    query = (
        select(SelectionConditions)
        .where(SelectionConditions.id == conditions_id)
        .options(
            selectinload(SelectionConditions.laboratory),
            selectinload(SelectionConditions.department),
        )
    )
    if not include_deleted:
        query = query.where(SelectionConditions.deleted_at.is_(None))
    result = await db.execute(query)
    return result.scalar_one_or_none()


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
    query = (
        select(SelectionConditions)
        .where(SelectionConditions.deleted_at.is_(None))
        .options(
            selectinload(SelectionConditions.laboratory),
            selectinload(SelectionConditions.department),
        )
    )

    conditions = []
    if laboratory_id:
        conditions.append(SelectionConditions.laboratory_id == laboratory_id)
    if department_id:
        conditions.append(SelectionConditions.department_id == department_id)
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "created_at": SelectionConditions.created_at,
    }
    order_by = build_order_by(
        sort_by, sort_order, sort_mapping, SelectionConditions.created_at
    )
    query = query.order_by(order_by)

    count_query = (
        select(func.count())
        .select_from(SelectionConditions)
        .where(SelectionConditions.deleted_at.is_(None))
    )
    count_conditions = []
    if laboratory_id:
        count_conditions.append(SelectionConditions.laboratory_id == laboratory_id)
    if department_id:
        count_conditions.append(SelectionConditions.department_id == department_id)
    if count_conditions:
        count_query = count_query.where(*count_conditions)

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        total_pages = calculate_total_pages(total, page_size)
        query = apply_pagination(query, page, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    result = await db.execute(query)
    selection_conditions = result.scalars().all()

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
        laboratory = await db.execute(
            select(Laboratory).where(Laboratory.id == conditions_data.laboratory_id)
        )
        if not laboratory.scalar_one_or_none():
            raise NotFoundError("Лаборатория не найдена")

    if conditions_data.department_id:
        department = await db.execute(
            select(Department).where(Department.id == conditions_data.department_id)
        )
        dept = department.scalar_one_or_none()
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
    db.add(selection_conditions)
    await db.flush()
    return selection_conditions


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
            department = await db.execute(
                select(Department).where(Department.id == dept_id)
            )
            dept = department.scalar_one_or_none()
            if not dept:
                raise NotFoundError("Подразделение не найдено")
            if lab_id and dept.laboratory_id != lab_id:
                raise ValidationError(
                    "Подразделение должно принадлежать выбранной лаборатории"
                )

    await db.flush()
    return selection_conditions


async def delete_selection_conditions(db: AsyncSession, conditions_id: int) -> None:
    """Удалить условия отбора (мягкое удаление)."""
    selection_conditions = await get_selection_conditions_by_id(db, conditions_id)
    if not selection_conditions:
        raise NotFoundError("Условия отбора не найдены")

    selection_conditions.soft_delete()
    await db.flush()


async def get_mass_fraction_oil_refraction_table_by_id(
    db: AsyncSession, table_id: int, include_deleted: bool = False
) -> Optional[MassFractionOilRefractionTable]:
    """Получить таблицу соотношения C к n по ID."""
    query = (
        select(MassFractionOilRefractionTable)
        .where(MassFractionOilRefractionTable.id == table_id)
        .options(selectinload(MassFractionOilRefractionTable.research_method))
    )
    if not include_deleted:
        query = query.where(MassFractionOilRefractionTable.deleted_at.is_(None))
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_mass_fraction_oil_refraction_tables(
    db: AsyncSession,
    research_method_id: Optional[int] = None,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[List[MassFractionOilRefractionTable], int, int]:
    """Получить список таблиц соотношения C, к, n."""
    query = (
        select(MassFractionOilRefractionTable)
        .where(MassFractionOilRefractionTable.deleted_at.is_(None))
        .options(selectinload(MassFractionOilRefractionTable.research_method))
    )

    if research_method_id:
        query = query.where(
            MassFractionOilRefractionTable.research_method_id == research_method_id
        )

    # Для числовой сортировки c_value используем cast в Float
    if sort_by == "c_value":
        c_value_numeric = cast(MassFractionOilRefractionTable.c_value, Float)
        if sort_order == "desc":
            query = query.order_by(c_value_numeric.desc())
        else:
            query = query.order_by(c_value_numeric.asc())
    else:
        sort_mapping = {
            "created_at": MassFractionOilRefractionTable.created_at,
        }
        order_by = build_order_by(
            sort_by,
            sort_order,
            sort_mapping,
            cast(MassFractionOilRefractionTable.c_value, Float),
            default_order="asc",
        )
        query = query.order_by(order_by)

    count_query = (
        select(func.count())
        .select_from(MassFractionOilRefractionTable)
        .where(MassFractionOilRefractionTable.deleted_at.is_(None))
    )
    if research_method_id:
        count_query = count_query.where(
            MassFractionOilRefractionTable.research_method_id == research_method_id
        )

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        total_pages = calculate_total_pages(total, page_size)
        query = apply_pagination(query, page, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    result = await db.execute(query)
    tables = result.scalars().all()

    return tables, total, total_pages


async def create_mass_fraction_oil_refraction_table(
    db: AsyncSession, table_data: MassFractionOilRefractionTableCreate
) -> MassFractionOilRefractionTable:
    """Создать таблицу соотношения C к n."""
    research_method = await db.execute(
        select(ResearchMethod).where(ResearchMethod.id == table_data.research_method_id)
    )
    if not research_method.scalar_one_or_none():
        raise NotFoundError("Метод исследования не найден")

    table = MassFractionOilRefractionTable(
        research_method_id=table_data.research_method_id,
        c_value=table_data.c_value,
        n_value=table_data.n_value,
    )
    db.add(table)
    await db.flush()
    return table


async def update_mass_fraction_oil_refraction_table(
    db: AsyncSession, table_id: int, table_data: MassFractionOilRefractionTableUpdate
) -> MassFractionOilRefractionTable:
    """Обновить таблицу соотношения C к n."""
    table = await get_mass_fraction_oil_refraction_table_by_id(db, table_id)
    if not table:
        raise NotFoundError("Таблица соотношения C к n не найдена")

    update_data = table_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(table, key, value)

    await db.flush()
    return table


async def delete_mass_fraction_oil_refraction_table(
    db: AsyncSession, table_id: int
) -> None:
    """Удалить таблицу соотношения C к n (мягкое удаление)."""
    table = await get_mass_fraction_oil_refraction_table_by_id(db, table_id)
    if not table:
        raise NotFoundError("Таблица соотношения C к n не найдена")

    table.soft_delete()
    await db.flush()
