"""
Сортировка списка протоколов: номер протокола (дата + число до «/»), пробы (мин. номер как у списка проб), акт отбора (ведущие цифры).
"""

from sqlalchemy import BigInteger, Integer, case, cast, func, select, text
from models.protocol import Protocol
from models.sample import Sample
from utils.sample_sort import (
    protocol_number_parts_combined_expr,
    registration_number_sort_columns,
)


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
    combined = cast(reg_num, BigInteger) * 10000 + cast(reg_year, BigInteger)
    protocol_table = Protocol.__table__.fullname
    sample_table = Sample.__table__.fullname
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
            cast(
                func.regexp_replace(Protocol.sampling_act_number, r"^([0-9]+).*$", r"\1"),
                Integer,
            ),
        ),
        else_=2147483647,
    )
