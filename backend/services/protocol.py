from typing import Any, Dict, List, Optional
import pendulum
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import bindparam
from core.exceptions import ConflictError, NotFoundError, ValidationError
from models.laboratory import Department, Laboratory
from models.protocol import Protocol, ProtocolTemplate
from models.sample import Sample
from schemas.protocol import (
    ProtocolCreate,
    ProtocolTemplateCreate,
    ProtocolTemplateUpdate,
    ProtocolUpdate,
)
from utils.filters import add_date_range_filter
from utils.pagination import apply_pagination, calculate_total_pages, get_total_count
from utils.sorting import build_order_by


async def get_protocol_by_id(
    db: AsyncSession, protocol_id: int, include_deleted: bool = False
) -> Optional[Protocol]:
    """Получить протокол по ID."""
    query = (
        select(Protocol)
        .where(Protocol.id == protocol_id)
        .options(
            selectinload(Protocol.laboratory),
            selectinload(Protocol.department),
            selectinload(Protocol.protocol_template),
        )
    )
    if not include_deleted:
        query = query.where(Protocol.deleted_at.is_(None))
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_protocols(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
    include_deleted: bool = False,
    page: int = 1,
    page_size: int = 20,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
    is_accredited: Optional[bool] = None,
    search: Optional[str] = None,
    search_date: Optional[str] = None,
    search_sampling_act: Optional[str] = None,
    search_samples: Optional[str] = None,
    test_protocol_date_from: Optional[pendulum.DateTime] = None,
    test_protocol_date_to: Optional[pendulum.DateTime] = None,
    created_at_from: Optional[pendulum.DateTime] = None,
    created_at_to: Optional[pendulum.DateTime] = None,
) -> tuple[List[Protocol], int, int]:
    """Получить список протоколов с пагинацией."""
    query = select(Protocol).options(
        selectinload(Protocol.laboratory), selectinload(Protocol.department)
    )

    if not include_deleted:
        query = query.where(Protocol.deleted_at.is_(None))

    conditions = []
    if laboratory_id:
        conditions.append(Protocol.laboratory_id == laboratory_id)
    if department_id:
        conditions.append(Protocol.department_id == department_id)
    if is_accredited is not None:
        conditions.append(Protocol.is_accredited == is_accredited)

    # Поиск по номеру и дате протокола
    if search and search_date:
        # Если указаны и номер, и дата - ищем по обоим одновременно (AND)
        conditions.append(Protocol.test_protocol_number.ilike(f"%{search}%"))
        try:
            search_date_parsed = pendulum.parse(search_date)
            if search_date_parsed:
                conditions.append(
                    func.date(Protocol.test_protocol_date) == search_date_parsed.date()
                )
        except Exception:
            pass
    elif search:
        # Если указан только номер - ищем по номеру ИЛИ дате (OR)
        search_conditions = [Protocol.test_protocol_number.ilike(f"%{search}%")]
        search_conditions.append(
            func.to_char(Protocol.test_protocol_date, "DD.MM.YYYY").ilike(f"%{search}%")
        )
        conditions.append(or_(*search_conditions))
    elif search_date:
        # Если указана только дата - ищем по дате
        try:
            search_date_parsed = pendulum.parse(search_date)
            if search_date_parsed:
                conditions.append(
                    func.date(Protocol.test_protocol_date) == search_date_parsed.date()
                )
        except Exception:
            pass

    if search_sampling_act:
        conditions.append(
            Protocol.sampling_act_number.ilike(f"%{search_sampling_act}%")
        )
    if search_samples:
        matching_samples = await db.execute(
            select(Sample.id).where(
                Sample.registration_number.ilike(f"%{search_samples}%"),
                Sample.deleted_at.is_(None),
            )
        )
        sample_ids = [row[0] for row in matching_samples.fetchall()]
        if sample_ids:
            sample_conditions = []
            for sample_id in sample_ids:
                sample_conditions.append(
                    func.cast(Protocol.samples, func.JSONB).contains([sample_id])
                )
            if sample_conditions:
                conditions.append(or_(*sample_conditions))
        else:
            conditions.append(text("1 = 0"))

    add_date_range_filter(
        conditions,
        test_protocol_date_from,
        test_protocol_date_to,
        Protocol.test_protocol_date,
    )
    add_date_range_filter(
        conditions, created_at_from, created_at_to, Protocol.created_at
    )

    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "test_protocol_number": Protocol.test_protocol_number,
        "test_protocol_date": Protocol.test_protocol_date,
        "sampling_act_number": Protocol.sampling_act_number,
        "is_accredited": Protocol.is_accredited,
        "created_at": Protocol.created_at,
    }
    order_by = build_order_by(sort_by, sort_order, sort_mapping, Protocol.created_at)
    query = query.order_by(order_by)

    count_query = select(func.count()).select_from(Protocol)
    if not include_deleted:
        count_query = count_query.where(Protocol.deleted_at.is_(None))
    count_conditions = []
    if laboratory_id:
        count_conditions.append(Protocol.laboratory_id == laboratory_id)
    if department_id:
        count_conditions.append(Protocol.department_id == department_id)
    if is_accredited is not None:
        count_conditions.append(Protocol.is_accredited == is_accredited)

    # Поиск по номеру и дате протокола (та же логика, что и в основном запросе)
    if search and search_date:
        # Если указаны и номер, и дата - ищем по обоим одновременно (AND)
        count_conditions.append(Protocol.test_protocol_number.ilike(f"%{search}%"))
        try:
            search_date_parsed = pendulum.parse(search_date)
            if search_date_parsed:
                count_conditions.append(
                    func.date(Protocol.test_protocol_date) == search_date_parsed.date()
                )
        except Exception:
            pass
    elif search:
        # Если указан только номер - ищем по номеру ИЛИ дате (OR)
        search_conditions = [Protocol.test_protocol_number.ilike(f"%{search}%")]
        search_conditions.append(
            func.to_char(Protocol.test_protocol_date, "DD.MM.YYYY").ilike(f"%{search}%")
        )
        count_conditions.append(or_(*search_conditions))
    elif search_date:
        # Если указана только дата - ищем по дате
        try:
            search_date_parsed = pendulum.parse(search_date)
            if search_date_parsed:
                count_conditions.append(
                    func.date(Protocol.test_protocol_date) == search_date_parsed.date()
                )
        except Exception:
            pass

    if search_sampling_act:
        count_conditions.append(
            Protocol.sampling_act_number.ilike(f"%{search_sampling_act}%")
        )
    if search_samples:
        matching_samples = await db.execute(
            select(Sample.id).where(
                Sample.registration_number.ilike(f"%{search_samples}%"),
                Sample.deleted_at.is_(None),
            )
        )
        sample_ids = [row[0] for row in matching_samples.fetchall()]
        if sample_ids:
            sample_conditions = []
            for sample_id in sample_ids:
                sample_conditions.append(
                    func.cast(Protocol.samples, func.JSONB).contains([sample_id])
                )
            if sample_conditions:
                count_conditions.append(or_(*sample_conditions))
        else:
            count_conditions.append(text("1 = 0"))
    add_date_range_filter(
        count_conditions,
        test_protocol_date_from,
        test_protocol_date_to,
        Protocol.test_protocol_date,
    )
    add_date_range_filter(
        count_conditions, created_at_from, created_at_to, Protocol.created_at
    )
    if count_conditions:
        count_query = count_query.where(*count_conditions)

    total = await get_total_count(db, count_query)
    total_pages = calculate_total_pages(total, page_size)

    query = apply_pagination(query, page, page_size)
    result = await db.execute(query)
    protocols = result.scalars().all()

    return protocols, total, total_pages


async def create_protocol(db: AsyncSession, protocol_data: ProtocolCreate) -> Protocol:
    """Создать протокол."""
    laboratory = await db.execute(
        select(Laboratory).where(Laboratory.id == protocol_data.laboratory_id)
    )
    if not laboratory.scalar_one_or_none():
        raise NotFoundError("Лаборатория не найдена")

    if protocol_data.department_id:
        department = await db.execute(
            select(Department).where(Department.id == protocol_data.department_id)
        )
        dept = department.scalar_one_or_none()
        if not dept:
            raise NotFoundError("Подразделение не найдено")
        if dept.laboratory_id != protocol_data.laboratory_id:
            raise ValidationError(
                "Подразделение должно принадлежать выбранной лаборатории"
            )

    if protocol_data.protocol_template_id:
        template = await db.execute(
            select(ProtocolTemplate).where(
                ProtocolTemplate.id == protocol_data.protocol_template_id
            )
        )
        if not template.scalar_one_or_none():
            raise NotFoundError("Шаблон протокола не найден")

    # Валидация уникальности номера акта отбора для неудаленных записей
    existing_protocol = await db.execute(
        select(Protocol).where(
            Protocol.sampling_act_number == protocol_data.sampling_act_number,
            Protocol.deleted_at.is_(None),
        )
    )
    if existing_protocol.scalars().first():
        raise ConflictError("Протокол с таким номером акта отбора уже существует")

    if protocol_data.samples:
        samples = await db.execute(
            select(Sample).where(
                Sample.id.in_(protocol_data.samples),
                Sample.deleted_at.is_(None),
            )
        )
        samples_list = samples.scalars().all()

        if len(samples_list) != len(protocol_data.samples):
            raise NotFoundError("Одна или несколько проб не найдены")

        test_objects = {
            sample.test_object for sample in samples_list if sample.test_object
        }
        if len(test_objects) > 1:
            raise ValidationError(
                f"Все пробы в протоколе должны иметь одинаковый объект исследования. "
                f"Найдены разные объекты: {', '.join(sorted(test_objects))}"
            )

    protocol = Protocol(
        test_protocol_number=protocol_data.test_protocol_number,
        test_protocol_date=protocol_data.test_protocol_date,
        is_accredited=protocol_data.is_accredited,
        sampling_act_number=protocol_data.sampling_act_number,
        issued=protocol_data.issued,
        approved=protocol_data.approved,
        issued_position=protocol_data.issued_position,
        approved_position=protocol_data.approved_position,
        protocol_template_id=protocol_data.protocol_template_id,
        laboratory_id=protocol_data.laboratory_id,
        department_id=protocol_data.department_id,
        samples=protocol_data.samples or [],
    )
    db.add(protocol)
    await db.flush()
    return protocol


async def update_protocol(
    db: AsyncSession, protocol_id: int, protocol_data: ProtocolUpdate
) -> Protocol:
    """Обновить протокол."""
    protocol = await get_protocol_by_id(db, protocol_id)
    if not protocol:
        raise NotFoundError("Протокол не найден")

    if protocol.deleted_at is not None:
        raise ValidationError("Невозможно редактировать удаленный протокол")

    update_data = protocol_data.model_dump(exclude_unset=True)

    # Валидация уникальности номера акта отбора для неудаленных записей
    if "sampling_act_number" in update_data:
        existing_protocol = await db.execute(
            select(Protocol).where(
                Protocol.sampling_act_number == update_data["sampling_act_number"],
                Protocol.deleted_at.is_(None),
                Protocol.id != protocol_id,
            )
        )
        if existing_protocol.scalars().first():
            raise ConflictError("Протокол с таким номером акта отбора уже существует")

    if "samples" in update_data and update_data["samples"] is not None:
        samples = await db.execute(
            select(Sample).where(
                Sample.id.in_(update_data["samples"]),
                Sample.deleted_at.is_(None),
            )
        )
        samples_list = samples.scalars().all()

        if len(samples_list) != len(update_data["samples"]):
            raise NotFoundError("Одна или несколько проб не найдены")

        test_objects = {
            sample.test_object for sample in samples_list if sample.test_object
        }
        if len(test_objects) > 1:
            raise ValidationError(
                f"Все пробы в протоколе должны иметь одинаковый объект исследования. "
                f"Найдены разные объекты: {', '.join(sorted(test_objects))}"
            )

    for key, value in update_data.items():
        setattr(protocol, key, value)

    if (
        protocol_data.laboratory_id is not None
        or protocol_data.department_id is not None
    ):
        lab_id = (
            protocol_data.laboratory_id
            if protocol_data.laboratory_id is not None
            else protocol.laboratory_id
        )
        dept_id = (
            protocol_data.department_id
            if protocol_data.department_id is not None
            else protocol.department_id
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
    return protocol


async def delete_protocol(db: AsyncSession, protocol_id: int) -> None:
    """Удалить протокол (мягкое удаление)."""
    protocol = await get_protocol_by_id(db, protocol_id)
    if not protocol:
        raise NotFoundError("Протокол не найден")

    protocol.soft_delete()
    await db.flush()


async def get_protocol_template_by_id(
    db: AsyncSession, template_id: int, include_deleted: bool = False
) -> Optional[ProtocolTemplate]:
    """Получить шаблон протокола по ID."""
    query = (
        select(ProtocolTemplate)
        .where(ProtocolTemplate.id == template_id)
        .options(
            selectinload(ProtocolTemplate.laboratory),
            selectinload(ProtocolTemplate.department),
        )
    )
    if not include_deleted:
        query = query.where(ProtocolTemplate.deleted_at.is_(None))
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_protocol_templates(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
    include_deleted: bool = False,
    page: int = 1,
    page_size: int = 20,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[List[ProtocolTemplate], int, int]:
    """Получить список шаблонов протоколов с пагинацией."""
    query = select(ProtocolTemplate).options(
        selectinload(ProtocolTemplate.laboratory),
        selectinload(ProtocolTemplate.department),
    )

    if not include_deleted:
        query = query.where(ProtocolTemplate.deleted_at.is_(None))

    conditions = []
    if laboratory_id:
        conditions.append(ProtocolTemplate.laboratory_id == laboratory_id)
    if department_id:
        conditions.append(ProtocolTemplate.department_id == department_id)
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "name": ProtocolTemplate.name,
        "version": ProtocolTemplate.version,
        "created_at": ProtocolTemplate.created_at,
    }
    order_by = build_order_by(
        sort_by, sort_order, sort_mapping, ProtocolTemplate.created_at
    )
    query = query.order_by(order_by)

    count_query = select(func.count()).select_from(ProtocolTemplate)
    if not include_deleted:
        count_query = count_query.where(ProtocolTemplate.deleted_at.is_(None))
    count_conditions = []
    if laboratory_id:
        count_conditions.append(ProtocolTemplate.laboratory_id == laboratory_id)
    if department_id:
        count_conditions.append(ProtocolTemplate.department_id == department_id)
    if count_conditions:
        count_query = count_query.where(*count_conditions)

    total = await get_total_count(db, count_query)
    total_pages = calculate_total_pages(total, page_size)

    query = apply_pagination(query, page, page_size)
    result = await db.execute(query)
    templates = result.scalars().all()

    return templates, total, total_pages


async def create_protocol_template(
    db: AsyncSession, template_data: ProtocolTemplateCreate
) -> ProtocolTemplate:
    """Создать шаблон протокола."""
    laboratory = await db.execute(
        select(Laboratory).where(Laboratory.id == template_data.laboratory_id)
    )
    if not laboratory.scalar_one_or_none():
        raise NotFoundError("Лаборатория не найдена")

    if template_data.department_id:
        department = await db.execute(
            select(Department).where(Department.id == template_data.department_id)
        )
        dept = department.scalar_one_or_none()
        if not dept:
            raise NotFoundError("Подразделение не найдено")
        if dept.laboratory_id != template_data.laboratory_id:
            raise ValidationError(
                "Подразделение должно принадлежать выбранной лаборатории"
            )

    latest = await db.execute(
        select(ProtocolTemplate)
        .where(
            ProtocolTemplate.name == template_data.name,
            ProtocolTemplate.laboratory_id == template_data.laboratory_id,
            ProtocolTemplate.department_id == template_data.department_id,
            ProtocolTemplate.deleted_at.is_(None),
        )
        .order_by(ProtocolTemplate.version.desc())
    )
    latest_template = latest.scalar_one_or_none()

    if latest_template:
        try:
            current_num = int(latest_template.version[1:])
            next_version = f"v{current_num + 1}"
        except (ValueError, IndexError):
            next_version = "v1"
    else:
        next_version = "v1"

    template = ProtocolTemplate(
        name=template_data.name,
        version=next_version,
        file=template_data.file,
        file_name=template_data.file_name,
        accreditation_header_row=template_data.accreditation_header_row,
        laboratory_id=template_data.laboratory_id,
        department_id=template_data.department_id,
    )
    db.add(template)
    await db.flush()
    return template


async def update_protocol_template(
    db: AsyncSession, template_id: int, template_data: ProtocolTemplateUpdate
) -> ProtocolTemplate:
    """Обновить шаблон протокола."""
    template = await get_protocol_template_by_id(db, template_id)
    if not template:
        raise NotFoundError("Шаблон протокола не найден")

    update_data = template_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(template, key, value)

    await db.flush()
    return template


async def delete_protocol_template(db: AsyncSession, template_id: int) -> None:
    """Удалить шаблон протокола (мягкое удаление)."""
    template = await get_protocol_template_by_id(db, template_id)
    if not template:
        raise NotFoundError("Шаблон протокола не найден")

    template.soft_delete()
    await db.flush()


async def get_protocols_by_sample_ids(
    db: AsyncSession, sample_ids: List[int]
) -> Dict[int, List[Dict[str, Any]]]:
    """Получить протоколы для списка проб."""
    if not sample_ids:
        return {}

    protocols_result = await db.execute(
        select(Protocol).where(
            Protocol.deleted_at.is_(None),
            text(
                "EXISTS (SELECT 1 FROM jsonb_array_elements_text(samples::jsonb) AS elem WHERE elem::int = ANY(:sample_ids))"
            ).bindparams(bindparam("sample_ids")),
        ),
        {"sample_ids": sample_ids},
    )
    all_protocols = protocols_result.scalars().all()

    result: Dict[int, List[Dict[str, Any]]] = {
        sample_id: [] for sample_id in sample_ids
    }

    for protocol in all_protocols:
        if protocol.samples:
            for sample_id in protocol.samples:
                if sample_id in result:
                    protocol_dict = {
                        "id": protocol.id,
                        "test_protocol_number": protocol.test_protocol_number,
                        "test_protocol_date": (
                            protocol.test_protocol_date.isoformat()
                            if protocol.test_protocol_date
                            else None
                        ),
                    }
                    result[sample_id].append(protocol_dict)

    return result
