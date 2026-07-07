from __future__ import annotations
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from repositories import protocol as protocol_repo
from utils.protocol_formatting import format_protocol_number


async def get_protocols_by_sample_ids(
    db: AsyncSession, sample_ids: list[int]
) -> dict[int, list[dict[str, Any]]]:
    """Получить протоколы для списка проб."""
    all_protocols, samples_list = await protocol_repo.get_protocols_by_sample_ids(
        db, sample_ids
    )
    samples_by_id = {sample.id: sample for sample in samples_list}

    result: dict[int, list[dict[str, Any]]] = {
        sample_id: [] for sample_id in sample_ids
    }

    for protocol in all_protocols:
        if protocol.samples:
            for sample_id in protocol.samples:
                if sample_id in result:
                    sample = samples_by_id.get(sample_id)
                    test_object = sample.test_object if sample else None

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
                            test_object,
                        ),
                    }
                    result[sample_id].append(protocol_dict)

    return result
