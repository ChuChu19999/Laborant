from __future__ import annotations
from typing import Any, List, Optional
import pendulum
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import ConflictError, NotFoundError, ValidationError
from models.protocol import Protocol, ProtocolTemplate
from repositories import laboratory as laboratory_repo
from repositories import protocol as protocol_repo
from repositories.base import flush_entity
from schemas.protocol import (
    ProtocolCreate,
    ProtocolResponse,
    ProtocolTemplateCreate,
    ProtocolTemplateResponse,
    ProtocolTemplateUpdate,
    ProtocolUpdate,
)
from services.calculation import get_calculations_by_sample
from services.sample import build_sample_response
from services.test_object import (
    get_protocol_abbreviations_by_names,
    pick_first_protocol_abbreviation,
    pick_protocol_abbreviation,
)
from services.visibility import validate_lab_and_department
from utils.pagination import calculate_total_pages
from utils.protocol_formatting import format_protocol_number


async def get_protocol_by_id(
    db: AsyncSession, protocol_id: int, include_deleted: bool = False
) -> Optional[Protocol]:
    """Получить протокол по ID."""
    return await protocol_repo.get_protocol_by_id(db, protocol_id, include_deleted)


async def get_protocols(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
    include_deleted: bool = False,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
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
    """Получить список протоколов."""
    sample_ids_for_search = None
    no_sample_match = False
    if search_samples:
        sample_ids_for_search = (
            await protocol_repo.get_sample_ids_by_registration_search(
                db, search_samples
            )
        )
        if not sample_ids_for_search:
            no_sample_match = True

    protocols, total = await protocol_repo.get_protocols(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        include_deleted=include_deleted,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
        is_accredited=is_accredited,
        search=search,
        search_date=search_date,
        search_sampling_act=search_sampling_act,
        sample_ids_for_search=sample_ids_for_search,
        no_sample_match=no_sample_match,
        test_protocol_date_from=test_protocol_date_from,
        test_protocol_date_to=test_protocol_date_to,
        created_at_from=created_at_from,
        created_at_to=created_at_to,
    )

    if page is not None and page_size is not None:
        total_pages = calculate_total_pages(total, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    return protocols, total, total_pages


async def create_protocol(db: AsyncSession, protocol_data: ProtocolCreate) -> Protocol:
    """Создать протокол."""
    await validate_lab_and_department(
        db, protocol_data.laboratory_id, protocol_data.department_id
    )

    if protocol_data.protocol_template_id:
        if not await protocol_repo.get_protocol_template_by_id_simple(
            db, protocol_data.protocol_template_id
        ):
            raise NotFoundError("Шаблон протокола не найден")

    if await protocol_repo.exists_protocol_by_sampling_act(
        db, protocol_data.sampling_act_number
    ):
        raise ConflictError("Протокол с таким номером акта отбора уже существует")

    if protocol_data.samples:
        samples_list = await protocol_repo.get_samples_by_ids(db, protocol_data.samples)

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
    return await protocol_repo.add_protocol(db, protocol)


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

    if "sampling_act_number" in update_data:
        if await protocol_repo.exists_protocol_by_sampling_act(
            db,
            update_data["sampling_act_number"],
            exclude_id=protocol_id,
        ):
            raise ConflictError("Протокол с таким номером акта отбора уже существует")

    if "samples" in update_data and update_data["samples"] is not None:
        samples_list = await protocol_repo.get_samples_by_ids(
            db, update_data["samples"]
        )

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

        await validate_lab_and_department(db, lab_id, dept_id)

    await flush_entity(db)
    return protocol


async def delete_protocol(db: AsyncSession, protocol_id: int) -> None:
    """Удалить протокол (мягкое удаление)."""
    protocol = await get_protocol_by_id(db, protocol_id)
    if not protocol:
        raise NotFoundError("Протокол не найден")

    protocol.soft_delete()
    await flush_entity(db)


async def get_protocol_template_by_id(
    db: AsyncSession, template_id: int, include_deleted: bool = False
) -> Optional[ProtocolTemplate]:
    """Получить шаблон протокола по ID."""
    return await protocol_repo.get_protocol_template_by_id(
        db, template_id, include_deleted
    )


async def get_protocol_templates(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
    include_deleted: bool = False,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[List[ProtocolTemplate], int, int]:
    """Получить список шаблонов протоколов."""
    templates, total = await protocol_repo.get_protocol_templates(
        db,
        laboratory_id,
        department_id,
        include_deleted,
        page,
        page_size,
        sort_by,
        sort_order,
    )

    if page is not None and page_size is not None:
        total_pages = calculate_total_pages(total, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    return templates, total, total_pages


async def create_protocol_template(
    db: AsyncSession, template_data: ProtocolTemplateCreate
) -> ProtocolTemplate:
    """Создать шаблон протокола."""
    if not await laboratory_repo.get_laboratory_by_id(db, template_data.laboratory_id):
        raise NotFoundError("Лаборатория не найдена")

    if template_data.department_id:
        dept = await laboratory_repo.get_department_by_id(
            db, template_data.department_id
        )
        if not dept:
            raise NotFoundError("Подразделение не найдено")
        if dept.laboratory_id != template_data.laboratory_id:
            raise ValidationError(
                "Подразделение должно принадлежать выбранной лаборатории"
            )

    latest_template = await protocol_repo.get_latest_protocol_template(
        db,
        template_data.name,
        template_data.laboratory_id,
        template_data.department_id,
    )

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
    return await protocol_repo.add_protocol_template(db, template)


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

    await flush_entity(db)
    return template


async def get_protocol_response_data(
    db: AsyncSession, protocol_id: int
) -> ProtocolResponse:
    """Получить протокол с данными для ответа API."""
    protocol = await protocol_repo.get_protocol_by_id(db, protocol_id)
    if not protocol:
        raise NotFoundError("Протокол не найден")
    protocol_dict = ProtocolResponse.model_validate(protocol).model_dump()
    if protocol.laboratory:
        protocol_dict["laboratory_name"] = protocol.laboratory.name
    if protocol.department:
        protocol_dict["department_name"] = protocol.department.name

    protocol_abbreviation = ""
    if protocol.samples:
        samples_list = await protocol_repo.get_samples_by_ids(db, protocol.samples)
        abbreviations = await get_protocol_abbreviations_by_names(
            db,
            [sample.test_object for sample in samples_list if sample.test_object],
        )
        protocol_abbreviation = pick_first_protocol_abbreviation(
            abbreviations,
            [sample.test_object for sample in samples_list],
        )

    protocol_dict["formatted_protocol_number"] = format_protocol_number(
        protocol.test_protocol_number,
        protocol.test_protocol_date,
        protocol.is_accredited,
        protocol_abbreviation,
    )

    return ProtocolResponse(**protocol_dict)


def build_protocol_template_response(
    template: ProtocolTemplate,
) -> ProtocolTemplateResponse:
    """Собрать ответ API по шаблону протокола с наименованиями связей."""
    template_dict = ProtocolTemplateResponse.model_validate(template).model_dump()
    if template.laboratory:
        template_dict["laboratory_name"] = template.laboratory.name
    if template.department:
        template_dict["department_name"] = template.department.name
    return ProtocolTemplateResponse(**template_dict)


async def get_protocol_template_response_data(
    db: AsyncSession, template_id: int
) -> ProtocolTemplateResponse:
    """Получить шаблон протокола с данными для ответа API."""
    template = await protocol_repo.get_protocol_template_by_id(db, template_id)
    if not template:
        raise NotFoundError("Шаблон протокола не найден")
    return build_protocol_template_response(template)


async def get_samples_by_ids(db: AsyncSession, sample_ids: list[int]):
    """Получить пробы по списку ID."""
    return await protocol_repo.get_samples_by_ids(db, sample_ids)


def _enrich_protocol_dict(
    protocol: Protocol,
    protocol_dict: dict,
    samples_by_id: dict[int, Any],
    sample_ids_with_calculations: set[int],
    abbreviations_by_name: dict[str, str],
) -> dict:
    """Дополнить словарь протокола пробами и признаками расчётов."""
    if protocol.laboratory:
        protocol_dict["laboratory_name"] = protocol.laboratory.name
    if protocol.department:
        protocol_dict["department_name"] = protocol.department.name

    protocol_abbreviation = ""
    if protocol.samples:
        samples_data = []
        for sample_id in protocol.samples:
            sample = samples_by_id.get(sample_id)
            if sample:
                samples_data.append(build_sample_response(sample).model_dump())
                if not protocol_abbreviation and sample.test_object:
                    protocol_abbreviation = pick_protocol_abbreviation(
                        abbreviations_by_name, sample.test_object
                    )
        protocol_dict["samples_data"] = samples_data
        protocol_dict["has_undeleted_calculations"] = any(
            sample_id in sample_ids_with_calculations for sample_id in protocol.samples
        )
    else:
        protocol_dict["has_undeleted_calculations"] = False

    protocol_dict["formatted_protocol_number"] = format_protocol_number(
        protocol.test_protocol_number,
        protocol.test_protocol_date,
        protocol.is_accredited,
        protocol_abbreviation,
    )
    return protocol_dict


async def build_protocols_list_response(
    db: AsyncSession, protocols: list[Protocol]
) -> list[ProtocolResponse]:
    """Собрать список ответов по протоколам с пакетной загрузкой проб и расчётов."""
    all_sample_ids: set[int] = set()
    for protocol in protocols:
        if protocol.samples:
            all_sample_ids.update(protocol.samples)

    samples_by_id: dict[int, Any] = {}
    if all_sample_ids:
        samples_list = await get_samples_by_ids(db, list(all_sample_ids))
        samples_by_id = {sample.id: sample for sample in samples_list}

    abbreviations_by_name = await get_protocol_abbreviations_by_names(
        db,
        [sample.test_object for sample in samples_by_id.values() if sample.test_object],
    )

    sample_ids_with_calculations: set[int] = set()
    if all_sample_ids:
        calculations = await get_calculations_by_sample(
            db, sample_ids=list(all_sample_ids), include_deleted=False
        )
        sample_ids_with_calculations = {
            calculation.sample_id for calculation in calculations
        }

    items = []
    for protocol in protocols:
        protocol_dict = ProtocolResponse.model_validate(protocol).model_dump()
        protocol_dict = _enrich_protocol_dict(
            protocol,
            protocol_dict,
            samples_by_id,
            sample_ids_with_calculations,
            abbreviations_by_name,
        )
        items.append(ProtocolResponse(**protocol_dict))

    return items


async def get_protocol_detail_response(
    db: AsyncSession, protocol_id: int
) -> ProtocolResponse:
    """Получить детальный ответ по протоколу с пробами и расчётами."""
    protocol = await get_protocol_by_id(db, protocol_id)
    if not protocol:
        raise NotFoundError("Протокол не найден")

    samples_by_id: dict[int, Any] = {}
    sample_ids_with_calculations: set[int] = set()
    if protocol.samples:
        samples_list = await get_samples_by_ids(db, protocol.samples)
        samples_by_id = {sample.id: sample for sample in samples_list}
        calculations = await get_calculations_by_sample(
            db, sample_ids=protocol.samples, include_deleted=False
        )
        sample_ids_with_calculations = {
            calculation.sample_id for calculation in calculations
        }

    abbreviations_by_name = await get_protocol_abbreviations_by_names(
        db,
        [sample.test_object for sample in samples_by_id.values() if sample.test_object],
    )

    protocol_dict = ProtocolResponse.model_validate(protocol).model_dump()
    protocol_dict = _enrich_protocol_dict(
        protocol,
        protocol_dict,
        samples_by_id,
        sample_ids_with_calculations,
        abbreviations_by_name,
    )
    return ProtocolResponse(**protocol_dict)
