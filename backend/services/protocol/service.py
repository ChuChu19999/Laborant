from __future__ import annotations
from typing import Any
import pendulum
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import ConflictError, DomainValidationError, NotFoundError
from models.protocol import Protocol
from repositories import (
    calculation as calculation_repo,
    protocol as protocol_repo,
    sample as sample_repo,
)
from repositories.base import flush_entity
from schemas.protocol import (
    ProtocolCreate,
    ProtocolResponse,
    ProtocolUpdate,
)
from schemas.sample import SampleResponse
from services.protocol.template import require_protocol_template_by_id
from services.test_object import (
    get_protocol_abbreviations_by_names,
    pick_first_protocol_abbreviation,
    pick_protocol_abbreviation,
)
from services.visibility import validate_lab_and_department
from utils.protocol.formatting import format_protocol_display


async def get_protocol_by_id(db: AsyncSession, protocol_id: int, include_deleted: bool = False) -> Protocol | None:
    """Получить протокол по ID."""
    return await protocol_repo.get_protocol_by_id(db, protocol_id, include_deleted)


async def require_protocol_by_id(db: AsyncSession, protocol_id: int, include_deleted: bool = False) -> Protocol:
    """Вернуть протокол по ID, иначе вызвать NotFoundError."""
    protocol = await get_protocol_by_id(db, protocol_id, include_deleted)
    if not protocol:
        raise NotFoundError("Протокол не найден")
    return protocol


async def get_protocols(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    include_deleted: bool = False,
    page: int | None = None,
    page_size: int | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
    is_accredited: bool | None = None,
    search: str | None = None,
    search_date: str | None = None,
    search_sampling_act: str | None = None,
    search_samples: str | None = None,
    test_protocol_date_from: pendulum.DateTime | None = None,
    test_protocol_date_to: pendulum.DateTime | None = None,
    created_at_from: pendulum.DateTime | None = None,
    created_at_to: pendulum.DateTime | None = None,
) -> tuple[list[ProtocolResponse], int]:
    """Получить список протоколов."""
    sample_ids_for_search = None
    no_sample_match = False
    if search_samples:
        sample_ids_for_search = await sample_repo.get_sample_ids_by_registration_search(db, search_samples)
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

    return await build_protocol_responses(db, protocols), total


async def create_protocol(db: AsyncSession, protocol_data: ProtocolCreate) -> Protocol:
    """Создать протокол."""
    await validate_lab_and_department(db, protocol_data.laboratory_id, protocol_data.department_id)

    if protocol_data.protocol_template_id is not None:
        await require_protocol_template_by_id(db, protocol_data.protocol_template_id, include_deleted=True)

    if await protocol_repo.exists_protocol_by_sampling_act(db, protocol_data.sampling_act_number):
        raise ConflictError("Протокол с таким номером акта отбора уже существует")

    if protocol_data.samples:
        samples_list = await sample_repo.get_samples_by_ids(db, protocol_data.samples)

        if len(samples_list) != len(protocol_data.samples):
            raise NotFoundError("Одна или несколько проб не найдены")

        test_objects = {sample.test_object for sample in samples_list if sample.test_object}
        if len(test_objects) > 1:
            raise DomainValidationError(
                f"Все пробы в протоколе должны иметь одинаковый объект исследования. "
                f"Найдены разные объекты: {', '.join(sorted(test_objects))}"
            )

    protocol = Protocol(
        test_protocol_number=protocol_data.test_protocol_number,
        test_protocol_date=protocol_data.test_protocol_date,
        is_accredited=protocol_data.is_accredited,
        sampling_act_number=protocol_data.sampling_act_number,
        sampling_act_date=protocol_data.sampling_act_date,
        sampling_request_number=protocol_data.sampling_request_number,
        sampling_request_date=protocol_data.sampling_request_date,
        sampling_method_nd=protocol_data.sampling_method_nd,
        sampling_plan_number=protocol_data.sampling_plan_number,
        issued=protocol_data.issued,
        approved=protocol_data.approved,
        issued_position=protocol_data.issued_position,
        approved_position=protocol_data.approved_position,
        protocol_template_id=protocol_data.protocol_template_id,
        laboratory_id=protocol_data.laboratory_id,
        department_id=protocol_data.department_id,
        samples=protocol_data.samples or [],
    )
    await protocol_repo.add_protocol(db, protocol)
    return await require_protocol_by_id(db, protocol.id)


async def update_protocol(db: AsyncSession, protocol: Protocol, protocol_data: ProtocolUpdate) -> Protocol:
    """Обновить протокол."""
    if protocol.deleted_at is not None:
        raise DomainValidationError("Невозможно редактировать удалённый протокол")

    update_data = protocol_data.model_dump(exclude_unset=True)

    if "sampling_act_number" in update_data and await protocol_repo.exists_protocol_by_sampling_act(
        db,
        update_data["sampling_act_number"],
        exclude_id=protocol.id,
    ):
        raise ConflictError("Протокол с таким номером акта отбора уже существует")

    if "protocol_template_id" in update_data and update_data["protocol_template_id"] is not None:
        await require_protocol_template_by_id(db, update_data["protocol_template_id"], include_deleted=True)

    if "samples" in update_data and update_data["samples"] is not None:
        samples_list = await sample_repo.get_samples_by_ids(db, update_data["samples"])

        if len(samples_list) != len(update_data["samples"]):
            raise NotFoundError("Одна или несколько проб не найдены")

        test_objects = {sample.test_object for sample in samples_list if sample.test_object}
        if len(test_objects) > 1:
            raise DomainValidationError(
                f"Все пробы в протоколе должны иметь одинаковый объект исследования. "
                f"Найдены разные объекты: {', '.join(sorted(test_objects))}"
            )

    if protocol_data.laboratory_id is not None or protocol_data.department_id is not None:
        lab_id = protocol_data.laboratory_id if protocol_data.laboratory_id is not None else protocol.laboratory_id
        dept_id = protocol_data.department_id if protocol_data.department_id is not None else protocol.department_id
        await validate_lab_and_department(db, lab_id, dept_id)

    for key, value in update_data.items():
        setattr(protocol, key, value)

    await flush_entity(db)
    return await require_protocol_by_id(db, protocol.id)


async def delete_protocol(db: AsyncSession, protocol: Protocol) -> None:
    """Мягко удалить протокол."""
    protocol.soft_delete()
    await flush_entity(db)


async def get_samples_by_ids(db: AsyncSession, sample_ids: list[int]):
    """Получить пробы по списку ID."""
    return await sample_repo.get_samples_by_ids(db, sample_ids)


def build_protocol_response(
    protocol: Protocol,
    *,
    samples_data: list[Any] | None = None,
    has_undeleted_calculations: bool | None = None,
    formatted_protocol_number: str | None = None,
) -> ProtocolResponse:
    """Собрать ProtocolResponse из ORM и доп. полей (пробы, номер, признак расчётов)."""
    response = ProtocolResponse.model_validate(protocol)
    updates: dict[str, object] = {}
    if samples_data is not None:
        updates["samples_data"] = [SampleResponse.model_validate(sample) for sample in samples_data]
    if has_undeleted_calculations is not None:
        updates["has_undeleted_calculations"] = has_undeleted_calculations
    if formatted_protocol_number is not None:
        updates["formatted_protocol_number"] = formatted_protocol_number
    if not updates:
        return response
    return response.model_copy(update=updates)


def _protocol_enrichment_fields(
    protocol: Protocol,
    samples_by_id: dict[int, Any],
    sample_ids_with_calculations: set[int],
    abbreviations_by_name: dict[str, str],
) -> tuple[list[Any], bool, str]:
    """Собрать доп. поля протокола: список проб, номер и признак незакрытых расчётов."""
    protocol_abbreviation = ""
    samples_data: list[Any] = []
    has_undeleted_calculations = False
    if protocol.samples:
        for sample_id in protocol.samples:
            sample = samples_by_id.get(sample_id)
            if sample:
                samples_data.append(sample)
                if not protocol_abbreviation and sample.test_object:
                    protocol_abbreviation = pick_protocol_abbreviation(abbreviations_by_name, sample.test_object)
        has_undeleted_calculations = any(sample_id in sample_ids_with_calculations for sample_id in protocol.samples)

    formatted_protocol_number = format_protocol_display(
        protocol.test_protocol_number,
        protocol.test_protocol_date,
        protocol.is_accredited,
        protocol_abbreviation,
    )
    return samples_data, has_undeleted_calculations, formatted_protocol_number


async def build_protocol_responses(db: AsyncSession, protocols: list[Protocol]) -> list[ProtocolResponse]:
    """Собрать список ProtocolResponse с доп. полями ответа."""
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
        calculations = await calculation_repo.get_calculations_by_sample(
            db, sample_ids=list(all_sample_ids), include_deleted=False
        )
        sample_ids_with_calculations = {calculation.sample_id for calculation in calculations}

    responses: list[ProtocolResponse] = []
    for protocol in protocols:
        samples_data, has_undeleted_calculations, formatted_protocol_number = _protocol_enrichment_fields(
            protocol,
            samples_by_id,
            sample_ids_with_calculations,
            abbreviations_by_name,
        )
        responses.append(
            build_protocol_response(
                protocol,
                samples_data=samples_data,
                has_undeleted_calculations=has_undeleted_calculations,
                formatted_protocol_number=formatted_protocol_number,
            )
        )
    return responses


async def get_protocol_for_response(
    db: AsyncSession,
    protocol_id: int,
    *,
    protocol: Protocol | None = None,
) -> ProtocolResponse:
    """Получить протокол с данными для ответа API."""
    if protocol is None:
        protocol = await require_protocol_by_id(db, protocol_id)
    responses = await build_protocol_responses(db, [protocol])
    return responses[0]


async def create_protocol_for_response(db: AsyncSession, protocol_data: ProtocolCreate) -> ProtocolResponse:
    """Создать протокол и вернуть ответ API."""
    protocol = await create_protocol(db, protocol_data)
    return await get_protocol_for_response_light(db, protocol.id, protocol=protocol)


async def update_protocol_for_response(
    db: AsyncSession,
    protocol_id: int,
    protocol_data: ProtocolUpdate,
    *,
    protocol: Protocol | None = None,
) -> ProtocolResponse:
    """Обновить протокол по ID и вернуть ответ API."""
    if protocol is None:
        protocol = await require_protocol_by_id(db, protocol_id)
    updated = await update_protocol(db, protocol, protocol_data)
    return await get_protocol_for_response_light(db, updated.id, protocol=updated)


def resolve_protocol_update_scope(protocol: Protocol, data: ProtocolUpdate) -> tuple[int, int | None]:
    """Определить область доступа после PATCH протокола."""
    fields_set = data.model_fields_set
    laboratory_id = (
        data.laboratory_id
        if "laboratory_id" in fields_set and data.laboratory_id is not None
        else protocol.laboratory_id
    )
    department_id = data.department_id if "department_id" in fields_set else protocol.department_id
    return (laboratory_id, department_id)


async def get_protocol_for_response_light(
    db: AsyncSession,
    protocol_id: int,
    *,
    protocol: Protocol | None = None,
) -> ProtocolResponse:
    """Получить протокол с отформатированным номером (без списка проб)."""
    if protocol is None:
        protocol = await require_protocol_by_id(db, protocol_id)

    protocol_abbreviation = ""
    if protocol.samples:
        samples_list = await sample_repo.get_samples_by_ids(db, protocol.samples)
        abbreviations = await get_protocol_abbreviations_by_names(
            db,
            [sample.test_object for sample in samples_list if sample.test_object],
        )
        protocol_abbreviation = pick_first_protocol_abbreviation(
            abbreviations,
            [sample.test_object for sample in samples_list],
        )

    return build_protocol_response(
        protocol,
        formatted_protocol_number=format_protocol_display(
            protocol.test_protocol_number,
            protocol.test_protocol_date,
            protocol.is_accredited,
            protocol_abbreviation,
        ),
    )
