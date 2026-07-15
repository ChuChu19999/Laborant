from __future__ import annotations
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from repositories import protocol as protocol_repo
from services.test_object import (
    get_protocol_abbreviations_by_names,
    pick_protocol_abbreviation,
)
from utils.protocol_formatting import format_protocol_number


async def get_protocols_by_sample_ids(
    db: AsyncSession, sample_ids: list[int]
) -> dict[int, list[dict[str, Any]]]:
    """Получить протоколы для списка проб."""
    all_protocols, samples_list = await protocol_repo.get_protocols_by_sample_ids(
        db, sample_ids
    )
    samples_by_id = {sample.id: sample for sample in samples_list}
    abbreviations_by_name = await get_protocol_abbreviations_by_names(
        db,
        [sample.test_object for sample in samples_list if sample.test_object],
    )

    result: dict[int, list[dict[str, Any]]] = {
        sample_id: [] for sample_id in sample_ids
    }

    for protocol in all_protocols:
        if protocol.samples:
            for sample_id in protocol.samples:
                if sample_id in result:
                    sample = samples_by_id.get(sample_id)
                    protocol_abbreviation = (
                        pick_protocol_abbreviation(
                            abbreviations_by_name, sample.test_object
                        )
                        if sample
                        else ""
                    )

                    protocol_dict = {
                        "id": protocol.id,
                        "test_protocol_number": protocol.test_protocol_number,
                        "test_protocol_date": (
                            protocol.test_protocol_date.isoformat()
                            if protocol.test_protocol_date
                            else None
                        ),
                        "is_accredited": protocol.is_accredited,
                        "formatted_protocol_number": format_protocol_number(
                            protocol.test_protocol_number,
                            protocol.test_protocol_date,
                            protocol.is_accredited,
                            protocol_abbreviation,
                        ),
                    }
                    result[sample_id].append(protocol_dict)

    return result
