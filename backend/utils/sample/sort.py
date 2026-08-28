from __future__ import annotations
from typing import cast
from sqlalchemy import (
    Integer,
    case,
    cast as sa_cast,
    func,
    select,
    text,
)
from sqlalchemy.sql.schema import Table
from models.protocol import Protocol
from models.sample import Sample


def registration_number_sort_columns():
    """
    Числовая часть номера пробы и полный год из суффикса -YY (например -26 → 2026).
    Без суффикса год считается «самым ранним» (0), чтобы такие номера шли перед любым годом при одном номере.
    """
    reg_num = case(
        (
            Sample.registration_number.op("~")(r"^[0-9]+"),
            sa_cast(
                func.regexp_replace(Sample.registration_number, r"^([0-9]+).*$", r"\1"),
                Integer,
            ),
        ),
        else_=2147483647,
    )
    reg_year = func.coalesce(
        case(
            (
                Sample.registration_number.op("~")(r"-[0-9]{2}$"),
                2000
                + sa_cast(
                    func.regexp_replace(Sample.registration_number, r"^.*-([0-9]{2})$", r"\1"),
                    Integer,
                ),
            ),
            else_=None,
        ),
        0,
    )
    return reg_num, reg_year


def protocols_sort_scalar_subquery():
    """
    Минимальный среди привязанных протоколов ключ: полная дата протокола, затем числовой номер до первого «/».
    У проб без протоколов подзапрос даёт NULL (в сортировке — в конце при asc).
    """
    from utils.protocol.sort import protocol_number_parts_combined_expr

    combined = protocol_number_parts_combined_expr(
        Protocol.test_protocol_number,
        Protocol.test_protocol_date,
    )
    protocol_table = cast(Table, Protocol.__table__).fullname
    sample_table = cast(Table, Sample.__table__).fullname
    sample_in_protocol_json = text(f"cast({protocol_table}.samples as jsonb) @> jsonb_build_array({sample_table}.id)")
    return (
        select(func.min(combined))
        .select_from(Protocol)
        .where(Protocol.deleted_at.is_(None), sample_in_protocol_json)
        .correlate(Sample)
        .scalar_subquery()
    )
