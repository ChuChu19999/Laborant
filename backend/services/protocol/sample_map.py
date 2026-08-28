from __future__ import annotations
from sqlalchemy.ext.asyncio import AsyncSession
from repositories import protocol as protocol_repo, sample as sample_repo
from schemas.sample import SampleProtocolSummary
from services.test_object import (
    get_protocol_abbreviations_by_names,
    pick_protocol_abbreviation,
)
from utils.protocol.formatting import format_protocol_display


async def get_protocols_by_sample_ids(
    db: AsyncSession, sample_ids: list[int]
) -> dict[int, list[SampleProtocolSummary]]:
    """Получить протоколы для списка проб."""
    all_protocols = await protocol_repo.get_protocols_by_sample_ids(db, sample_ids)
    samples_list = await sample_repo.get_samples_by_ids(db, sample_ids)
    samples_by_id = {sample.id: sample for sample in samples_list}
    abbreviations_by_name = await get_protocol_abbreviations_by_names(
        db,
        [sample.test_object for sample in samples_list if sample.test_object],
    )

    result: dict[int, list[SampleProtocolSummary]] = {sample_id: [] for sample_id in sample_ids}

    for protocol in all_protocols:
        if not protocol.samples:
            continue
        for sample_id in protocol.samples:
            if sample_id not in result:
                continue
            sample = samples_by_id.get(sample_id)
            protocol_abbreviation = (
                pick_protocol_abbreviation(abbreviations_by_name, sample.test_object) if sample else ""
            )
            result[sample_id].append(
                SampleProtocolSummary(
                    id=protocol.id,
                    test_protocol_number=protocol.test_protocol_number,
                    test_protocol_date=protocol.test_protocol_date,
                    is_accredited=protocol.is_accredited,
                    formatted_protocol_number=format_protocol_display(
                        protocol.test_protocol_number,
                        protocol.test_protocol_date,
                        protocol.is_accredited,
                        protocol_abbreviation,
                    ),
                )
            )

    return result
