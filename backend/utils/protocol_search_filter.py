from sqlalchemy import and_, case, exists, func, literal, not_, or_, select, text
from models.protocol import Protocol
from models.sample import Sample
from models.test_object import TestObject


def _escape_ilike_pattern(fragment: str) -> str:
    """Экранирование % и _ для ILIKE."""
    return fragment.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _suffix_from_test_object_sql():
    """Аббревиатура из справочника объектов испытаний по наименованию пробы."""
    return func.coalesce(
        (
            select(TestObject.protocol_abbreviation)
            .where(
                TestObject.deleted_at.is_(None),
                Sample.test_object.is_not(None),
                func.lower(TestObject.name)
                == func.lower(func.trim(Sample.test_object)),
                TestObject.protocol_abbreviation.is_not(None),
                func.trim(TestObject.protocol_abbreviation) != literal(""),
            )
            .limit(1)
            .correlate(Sample)
            .scalar_subquery()
        ),
        literal(""),
    )


def _protocol_display_sql():
    """Строка отображения протокола для пары (проба + протокол), как format_protocol_number."""
    suffix_sql = _suffix_from_test_object_sql()
    num_blank = or_(
        Protocol.test_protocol_number.is_(None),
        func.trim(func.coalesce(Protocol.test_protocol_number, literal("")))
        == literal(""),
    )
    date_str = func.to_char(Protocol.test_protocol_date, "DD.MM.YYYY")
    not_accredited = or_(
        Protocol.is_accredited.is_(False),
        Protocol.is_accredited.is_(None),
    )

    accredited_with_parts = case(
        (
            and_(not_(num_blank), Protocol.test_protocol_date.isnot(None)),
            case(
                (
                    func.length(func.trim(suffix_sql)) > 0,
                    func.concat(
                        Protocol.test_protocol_number,
                        literal("/07/"),
                        suffix_sql,
                        literal(" от "),
                        date_str,
                    ),
                ),
                else_=func.concat(
                    Protocol.test_protocol_number,
                    literal("/07 от "),
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
            func.concat(literal("от "), date_str),
        ),
        else_=literal("-"),
    )

    return case(
        (
            and_(num_blank, Protocol.test_protocol_date.is_(None)),
            literal("-"),
        ),
        (
            not_accredited,
            case(
                (num_blank, literal("-")),
                else_=Protocol.test_protocol_number,
            ),
        ),
        else_=accredited_with_parts,
    )


def sample_has_protocol_display_ilike(search_fragment: str):
    """
    Условие для WHERE: у пробы есть протокол, у которого строка отображения содержит подстроку поиска.
    Вызывать только если после strip строка непустая.
    """
    stripped = search_fragment.strip()
    escaped = _escape_ilike_pattern(stripped)
    pattern = f"%{escaped}%"
    display_sql = _protocol_display_sql()
    protocol_table = Protocol.__table__.fullname
    sample_table = Sample.__table__.fullname
    protocol_links_sample = text(
        f"cast({protocol_table}.samples as jsonb) @> "
        f"jsonb_build_array({sample_table}.id)"
    )

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
    Условие для строки списка протоколов: хотя бы у одной связанной пробы строка отображения
    (как format_protocol_number для этой пары) содержит подстроку поиска.
    Вызывать только если после strip строка непустая.
    """
    stripped = search_fragment.strip()
    escaped = _escape_ilike_pattern(stripped)
    pattern = f"%{escaped}%"
    display_sql = _protocol_display_sql()
    protocol_table = Protocol.__table__.fullname
    sample_table = Sample.__table__.fullname
    sample_linked_to_protocol = text(
        f"cast({protocol_table}.samples as jsonb) @> "
        f"jsonb_build_array({sample_table}.id)"
    )
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
