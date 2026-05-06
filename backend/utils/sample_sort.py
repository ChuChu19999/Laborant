"""
Выражения сортировки списка проб: номер по числу и году из суффикса -YY; протоколы по году и номеру.
"""

from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    Integer,
    case,
    cast,
    func,
    literal,
    select,
    text,
)
from models.protocol import Protocol
from models.sample import Sample

# Epoch (~ дата в будущем), если даты протокола нет — чтобы при сортировке по возрастанию такие строки шли после записей с датой.
_PROTOCOL_DATE_MISSING_EPOCH = 253402214400


def protocol_number_parts_combined_expr(
    test_protocol_number_column, test_protocol_date_column
):
    """
    Полная дата протокола (поле даты), затем числовая часть номера до первого «/».
    День и месяц учитываются через UNIX-epoch даты; без даты — в конце при asc.
    Результат в BIGINT.
    """
    date_epoch = cast(
        func.extract(
            "epoch",
            cast(test_protocol_date_column, TIMESTAMP),
        ),
        BigInteger,
    )
    date_sort = func.coalesce(date_epoch, literal(_PROTOCOL_DATE_MISSING_EPOCH))
    num_part = func.coalesce(
        cast(
            func.nullif(
                func.regexp_replace(
                    func.split_part(
                        func.coalesce(test_protocol_number_column, ""), "/", 1
                    ),
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
    return cast(date_sort, BigInteger) * 1000000 + cast(num_part, BigInteger)


def registration_number_sort_columns():
    """
    Числовая часть номера пробы и полный год из суффикса -YY (например -26 → 2026).
    Без суффикса год считается «самым ранним» (0), чтобы такие номера шли перед любым годом при одном номере.
    """
    reg_num = case(
        (
            Sample.registration_number.op("~")(r"^[0-9]+"),
            cast(
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
                + cast(
                    func.regexp_replace(
                        Sample.registration_number, r"^.*-([0-9]{2})$", r"\1"
                    ),
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
    combined = protocol_number_parts_combined_expr(
        Protocol.test_protocol_number,
        Protocol.test_protocol_date,
    )
    protocol_table = Protocol.__table__.fullname
    sample_table = Sample.__table__.fullname
    sample_in_protocol_json = text(
        f"cast({protocol_table}.samples as jsonb) @> "
        f"jsonb_build_array({sample_table}.id)"
    )
    return (
        select(func.min(combined))
        .select_from(Protocol)
        .where(Protocol.deleted_at.is_(None), sample_in_protocol_json)
        .correlate(Sample)
        .scalar_subquery()
    )
