from __future__ import annotations
from sqlalchemy import func, literal, select
from models.sample import Sample
from models.test_object import TestObject

# Номер протокола с аккредитованной частью.
PROTOCOL_DISPLAY_EMPTY = "-"
PROTOCOL_ACCREDITED_MARK = "/07"
PROTOCOL_DATE_LABEL = "от"

PROTOCOL_ACCREDITED_WITH_SUFFIX = f"{PROTOCOL_ACCREDITED_MARK}/"
PROTOCOL_DATE_SEPARATOR = f" {PROTOCOL_DATE_LABEL} "
PROTOCOL_DATE_ONLY_PREFIX = f"{PROTOCOL_DATE_LABEL} "


def get_protocol_suffix(abbreviation: str | None) -> str:
    """Вернуть аббревиатуру объекта испытаний для аккредитованного номера."""
    return (abbreviation or "").strip()


def build_protocol_suffix_sql_case():
    """Аббревиатура из справочника объектов испытаний по наименованию пробы (SQL)."""
    return func.coalesce(
        (
            select(TestObject.protocol_abbreviation)
            .where(
                TestObject.deleted_at.is_(None),
                Sample.test_object.is_not(None),
                func.lower(TestObject.name) == func.lower(func.trim(Sample.test_object)),
                TestObject.protocol_abbreviation.is_not(None),
                func.trim(TestObject.protocol_abbreviation) != literal(""),
            )
            .limit(1)
            .correlate(Sample)
            .scalar_subquery()
        ),
        literal(""),
    )


def build_accredited_protocol_number(number: str, abbreviation: str | None) -> str:
    """Собрать аккредитованную часть: «N/07/ABB» или «N/07»."""
    suffix = get_protocol_suffix(abbreviation)
    if suffix:
        return f"{number}{PROTOCOL_ACCREDITED_WITH_SUFFIX}{suffix}"
    return f"{number}{PROTOCOL_ACCREDITED_MARK}"
