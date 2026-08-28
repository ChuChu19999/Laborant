from __future__ import annotations
from typing import cast
from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    Integer,
    case,
    cast as sa_cast,
    func,
    literal,
    select,
    text,
)
from sqlalchemy.sql.schema import Table
from models.protocol import Protocol
from models.sample import Sample
from utils.sample.sort import registration_number_sort_columns

# Epoch (~ дата в будущем), если даты протокола нет — чтобы при сортировке по возрастанию такие строки шли после записей с датой.
_PROTOCOL_DATE_MISSING_EPOCH = 253402214400


def protocol_number_parts_combined_expr(test_protocol_number_column, test_protocol_date_column):
    """
    Полная дата протокола (поле даты), затем числовая часть номера до первого «/».
    День и месяц учитываются через UNIX-epoch даты; без даты — в конце при asc.
    Результат в BIGINT.
    """
    date_epoch = sa_cast(
        func.extract(
            "epoch",
            sa_cast(test_protocol_date_column, TIMESTAMP),
        ),
        BigInteger,
    )
    date_sort = func.coalesce(date_epoch, literal(_PROTOCOL_DATE_MISSING_EPOCH))
    num_part = func.coalesce(
        sa_cast(
            func.nullif(
                func.regexp_replace(
                    func.split_part(func.coalesce(test_protocol_number_column, ""), "/", 1),
                    "[^0-9]",
                    "",
                    "g",
                ),
                "",
            ),
            Integer,
        ),
        999999,
    )
    return sa_cast(date_sort, BigInteger) * 1000000 + sa_cast(num_part, BigInteger)


def protocol_row_sort_combined():
    """Одна строка протокола: полная дата, затем числовой номер до первого «/»."""
    return protocol_number_parts_combined_expr(
        Protocol.test_protocol_number,
        Protocol.test_protocol_date,
    )


def protocols_list_samples_registration_sort_subquery():
    """
    Минимальный ключ среди проб протокола — та же логика, что сортировка по номеру пробы
    (число + год из суффикса -YY).
    """
    reg_num, reg_year = registration_number_sort_columns()
    combined = sa_cast(reg_num, BigInteger) * 10000 + sa_cast(reg_year, BigInteger)
    protocol_table = cast(Table, Protocol.__table__).fullname
    sample_table = cast(Table, Sample.__table__).fullname
    protocol_links_sample = text(f"cast({protocol_table}.samples as jsonb) @> jsonb_build_array({sample_table}.id)")
    return (
        select(func.min(combined))
        .select_from(Sample)
        .where(Sample.deleted_at.is_(None), protocol_links_sample)
        .correlate(Protocol)
        .scalar_subquery()
    )


def sampling_act_number_sort_expression():
    """Ведущая целочисленная часть номера акта отбора."""
    return case(
        (
            Protocol.sampling_act_number.op("~")(r"^[0-9]+"),
            sa_cast(
                func.regexp_replace(Protocol.sampling_act_number, r"^([0-9]+).*$", r"\1"),
                Integer,
            ),
        ),
        else_=2147483647,
    )
