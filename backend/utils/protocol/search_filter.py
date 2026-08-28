from __future__ import annotations
from typing import cast
from sqlalchemy import and_, case, exists, func, literal, not_, or_, select, text
from sqlalchemy.sql.schema import Table
from models.protocol import Protocol
from models.sample import Sample
from utils.protocol.display_rules import (
    PROTOCOL_ACCREDITED_MARK,
    PROTOCOL_ACCREDITED_WITH_SUFFIX,
    PROTOCOL_DATE_ONLY_PREFIX,
    PROTOCOL_DATE_SEPARATOR,
    PROTOCOL_DISPLAY_EMPTY,
    build_protocol_suffix_sql_case,
)


def _escape_ilike_pattern(fragment: str) -> str:
    """Экранировать % и _ для ILIKE."""
    return fragment.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _model_table_fullname(model: type[Protocol] | type[Sample]) -> str:
    """Вернуть полное имя таблицы ORM-модели (schema.table) для сырого SQL."""
    return cast(Table, model.__table__).fullname


def _protocol_display_sql():
    """Строка отображения протокола для пары (проба + протокол), как format_protocol_display."""
    suffix_sql = build_protocol_suffix_sql_case()
    num_blank = or_(
        Protocol.test_protocol_number.is_(None),
        func.trim(func.coalesce(Protocol.test_protocol_number, literal(""))) == literal(""),
    )
    date_str = func.to_char(Protocol.test_protocol_date, "DD.MM.YYYY")
    not_accredited = or_(
        Protocol.is_accredited.is_(False),
        Protocol.is_accredited.is_(None),
    )
    accredited_mark_with_date = f"{PROTOCOL_ACCREDITED_MARK}{PROTOCOL_DATE_SEPARATOR}"

    accredited_with_parts = case(
        (
            and_(not_(num_blank), Protocol.test_protocol_date.isnot(None)),
            case(
                (
                    func.length(func.trim(suffix_sql)) > 0,
                    func.concat(
                        Protocol.test_protocol_number,
                        literal(PROTOCOL_ACCREDITED_WITH_SUFFIX),
                        suffix_sql,
                        literal(PROTOCOL_DATE_SEPARATOR),
                        date_str,
                    ),
                ),
                else_=func.concat(
                    Protocol.test_protocol_number,
                    literal(accredited_mark_with_date),
                    date_str,
                ),
            ),
        ),
        (
            and_(not_(num_blank), Protocol.test_protocol_date.is_(None)),
            Protocol.test_protocol_number,
        ),
        (
            and_(num_blank, Protocol.test_protocol_date.isnot(None)),
            func.concat(literal(PROTOCOL_DATE_ONLY_PREFIX), date_str),
        ),
        else_=literal(PROTOCOL_DISPLAY_EMPTY),
    )

    return case(
        (
            and_(num_blank, Protocol.test_protocol_date.is_(None)),
            literal(PROTOCOL_DISPLAY_EMPTY),
        ),
        (
            not_accredited,
            case(
                (num_blank, literal(PROTOCOL_DISPLAY_EMPTY)),
                else_=Protocol.test_protocol_number,
            ),
        ),
        else_=accredited_with_parts,
    )


def sample_has_protocol_display_ilike(search_fragment: str):
    """
    Условие WHERE: у пробы есть протокол, чья строка отображения содержит подстроку поиска.
    Вызывать только если после strip строка непустая.
    """
    stripped = search_fragment.strip()
    escaped = _escape_ilike_pattern(stripped)
    pattern = f"%{escaped}%"
    display_sql = _protocol_display_sql()
    protocol_table = _model_table_fullname(Protocol)
    sample_table = _model_table_fullname(Sample)
    protocol_links_sample = text(f"cast({protocol_table}.samples as jsonb) @> jsonb_build_array({sample_table}.id)")

    return exists(
        select(literal(1))
        .select_from(Protocol)
        .where(
            Protocol.deleted_at.is_(None),
            protocol_links_sample,
            display_sql.ilike(pattern, escape="\\"),
        )
        .correlate(Sample)
    )


def protocol_list_row_matches_display_ilike(search_fragment: str):
    """
    Условие для строки списка протоколов: хотя бы у одной связанной пробы строка
    отображения (как format_protocol_display) содержит подстроку поиска.
    Вызывать только если после strip строка непустая.
    """
    stripped = search_fragment.strip()
    escaped = _escape_ilike_pattern(stripped)
    pattern = f"%{escaped}%"
    display_sql = _protocol_display_sql()
    protocol_table = _model_table_fullname(Protocol)
    sample_table = _model_table_fullname(Sample)
    sample_linked_to_protocol = text(f"cast({protocol_table}.samples as jsonb) @> jsonb_build_array({sample_table}.id)")
    return exists(
        select(literal(1))
        .select_from(Sample)
        .where(
            Sample.deleted_at.is_(None),
            sample_linked_to_protocol,
            display_sql.ilike(pattern, escape="\\"),
        )
        .correlate(Protocol)
    )
