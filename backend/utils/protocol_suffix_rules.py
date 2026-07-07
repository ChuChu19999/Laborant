from __future__ import annotations
from sqlalchemy import ColumnElement, case, literal

# Порядок важен: более специфичные подстроки раньше общих.
PROTOCOL_OBJECT_SUFFIX_RULES: tuple[tuple[str, str], ...] = (
    ("дегазированный конденсат", "дк"),
    ("нефтеконденсатная смесь", "нкс"),
    ("нефть калибровочная", "н"),
    ("нефть", "н"),
    ("дизельное топливо", "дт"),
    ("отработанные нефтепродукты", "он"),
    ("масло", "м"),
    ("смесь жидких углеводородов", "с"),
    ("ингибитор коррозии", "ик"),
)


def get_protocol_object_suffix(test_object: str | None) -> str:
    """Суффикс номера протокола по объекту испытания."""
    if not test_object:
        return ""

    test_object_lower = test_object.lower()
    for pattern, suffix in PROTOCOL_OBJECT_SUFFIX_RULES:
        if pattern in test_object_lower:
            return suffix
    return ""


def build_protocol_object_suffix_sql_case(
    test_object_lower: ColumnElement,
) -> ColumnElement:
    """SQL case для суффикса — те же правила, что get_protocol_object_suffix."""
    whens = [
        (test_object_lower.like(f"%{pattern}%"), literal(suffix))
        for pattern, suffix in PROTOCOL_OBJECT_SUFFIX_RULES
    ]
    return case(*whens, else_=literal(""))
