from __future__ import annotations
from dataclasses import dataclass
from datetime import date
from typing import Any
import orjson
import pendulum
from sqlalchemy.ext.asyncio import AsyncSession
from models.calculation import Calculation
from repositories import calculation as calculation_repo
from services.ilninm_reports.constants import (
    FRACTIONAL_RESULT_FIELD_NK,
    METHOD_FRACTIONAL_OIL,
    REPORT_EMPTY_CELL_VALUE,
)
from utils.calculation.fractional_keys import normalize_fractional_key
from utils.calculation.result_display import format_calculation_result_display
from utils.protocol.template_markers import format_decimal_ru


def report_display(value: str | None) -> str:
    """Подставить «-» вместо пустых значений и прочерков в ячейках отчёта."""
    if value is None:
        return REPORT_EMPTY_CELL_VALUE
    text = str(value).strip()
    if not text or text == REPORT_EMPTY_CELL_VALUE:
        return REPORT_EMPTY_CELL_VALUE
    return text


@dataclass(frozen=True)
class MethodColumnSpec:
    """Описание столбца отчёта, значение которого берётся из расчёта."""

    column: int
    method_name: str
    group_name: str | None = None
    group_prefix: str | None = None
    fractional_field: str | None = None


def format_report_period(date_from: pendulum.DateTime, date_to: pendulum.DateTime) -> str:
    """Сформировать текст периода для метки {period} в шапке отчёта."""
    return f"{date_from.format('DD.MM.YYYY')} - {date_to.format('DD.MM.YYYY')}"


def format_sampling_date(value: date | None) -> str:
    """Отформатировать дату отбора как DD.MM.YYYY для ячейки отчёта."""
    if value is None:
        return REPORT_EMPTY_CELL_VALUE
    return pendulum.instance(value).format("DD.MM.YYYY")


def normalize_label(value: str | None) -> str:
    """Нормализовать подпись метода или группы для сопоставления."""
    if not value:
        return ""
    text = value.strip().lower()
    text = text.replace("℃", "°c")
    return text


def group_matches(actual_group: str, spec: MethodColumnSpec) -> bool:
    """Проверить соответствие группы методов спецификации столбца."""
    actual = normalize_label(actual_group)
    if spec.group_prefix:
        prefix = normalize_label(spec.group_prefix)
        return actual.startswith(prefix) or prefix in actual
    if spec.group_name is None:
        return True
    expected = normalize_label(spec.group_name)
    if not expected:
        return True
    return actual == expected or expected in actual or actual in expected


def method_name_matches(actual_name: str, expected_name: str) -> bool:
    """Сравнить имена методов без учёта регистра и ℃/°C."""
    return normalize_label(actual_name) == normalize_label(expected_name)


def parse_calculation_result_payload(calc: Calculation) -> dict[str, Any]:
    """Разобрать result расчёта в словарь (JSON или уже dict)."""
    raw = calc.result
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return {}
        try:
            parsed = orjson.loads(text)
        except orjson.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def merged_fractional_result_payload(calc: Calculation) -> dict[str, Any]:
    """Объединить поля фракционного состава из result и _fractional_data."""
    data = parse_calculation_result_payload(calc)
    if "_fractional_data" in data:
        combined: dict[str, Any] = {}
        fractional_data = data.get("_fractional_data") or {}
        if isinstance(fractional_data, dict):
            for card_data in fractional_data.values():
                if isinstance(card_data, dict):
                    for field, val in card_data.items():
                        if field not in combined or combined[field] in (None, "", "-"):
                            combined[field] = val
        data = combined
    normalized: dict[str, Any] = {}
    for key, val in data.items():
        normalized[normalize_fractional_key(key)] = val
    return normalized


def fractional_field_value(data: dict[str, Any], field_key: str) -> str:
    """Вернуть значение поля фракционного состава для ячейки отчёта."""
    value = data.get(field_key, "")
    if (not value or value == "-") and field_key == FRACTIONAL_RESULT_FIELD_NK:
        value = data.get("Температура н,к.", "")
    if value is None or value == "" or value == "-":
        return REPORT_EMPTY_CELL_VALUE
    return report_display(format_decimal_ru(value))


def calculation_display_value(calc: Calculation, spec: MethodColumnSpec) -> str:
    """Вернуть отображаемое значение расчёта для столбца отчёта."""
    if spec.fractional_field:
        return fractional_field_value(merged_fractional_result_payload(calc), spec.fractional_field)
    method_name = (calc.research_method.name or "") if calc.research_method else ""
    display = format_calculation_result_display(calc.result, method_name, calc.input_data)
    if display != str(calc.result if calc.result is not None else ""):
        return report_display(display)
    return report_display(format_decimal_ru(calc.result))


def calculation_matches_spec(calc: Calculation, spec: MethodColumnSpec) -> bool:
    """Проверить, подходит ли расчёт под спецификацию столбца."""
    method = calc.research_method
    if method is None:
        return False
    if not method_name_matches(method.name or "", spec.method_name):
        return False
    if spec.group_name is None and spec.group_prefix is None:
        return True
    groups = method.groups or []
    if not groups:
        return bool(spec.fractional_field and method_name_matches(method.name or "", METHOD_FRACTIONAL_OIL))
    return any(group_matches(group.name or "", spec) for group in groups)


async def get_calculations_grouped_by_sample_ids(
    db: AsyncSession, sample_ids: list[int]
) -> dict[int, list[Calculation]]:
    """Вернуть расчёты, сгруппированные по идентификатору пробы."""
    return await calculation_repo.get_calculations_grouped_by_sample_ids(db, sample_ids)
