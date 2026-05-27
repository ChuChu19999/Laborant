"""
Данные для отчёта «Результаты КГС» (ИЛНиНМ).

Пробы за период по дате отбора: тип «Паспортизация», объект «дегазированный конденсат».
Группировка по нормализованному месту отбора, внутри группы — по дате отбора.
"""

import re
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional
import pendulum
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.calculation import Calculation
from models.laboratory import SamplingLocation
from models.sample import Sample
from services.ilninm_reports.constants import (
    GROUP_DENSITY,
    GROUP_MOLECULAR_MASS,
    KGS_SAMPLING_LOCATION_PREFIXES,
    METHOD_CHLORIDE_SALTS,
    METHOD_CONDENSATE,
    METHOD_MECHANICAL_IMPURITIES,
    METHOD_WATER_MASS_FRACTION,
    REPORT_EMPTY_CELL_VALUE,
    SAMPLE_TYPE_PASPORTIZACIYA,
    TEST_OBJECT_DEGASSED_CONDENSATE,
)
from services.ilninm_reports.physicochemical import (
    MethodColumnSpec,
    _calculation_display_value,
    _calculation_matches_spec,
    _format_sampling_date,
    _get_calculations_by_sample,
    _report_display,
    format_report_period,
)
from utils.filters import add_date_range_filter

KGS_ABSENCE_DISPLAY = "отсутствие"

_KGS_LOCATION_PREFIX_RE = tuple(
    re.compile(rf"(?:^|[\s,;])({re.escape(p)})(?=[\s,;]|$)")
    for p in sorted(KGS_SAMPLING_LOCATION_PREFIXES, key=len, reverse=True)
)

KGS_METHOD_COLUMNS: tuple[MethodColumnSpec, ...] = (
    MethodColumnSpec(4, METHOD_CONDENSATE, GROUP_MOLECULAR_MASS),
    MethodColumnSpec(
        5,
        METHOD_CONDENSATE,
        GROUP_DENSITY,
        group_prefix="Плотность при температуре",
    ),
    MethodColumnSpec(6, METHOD_MECHANICAL_IMPURITIES, None),
    MethodColumnSpec(7, METHOD_WATER_MASS_FRACTION, None),
    MethodColumnSpec(8, METHOD_CHLORIDE_SALTS, None),
)

_TEXT_ZERO_FOR_AVERAGE = frozenset(
    {
        "",
        "-",
        "отс",
        "отс.",
        "отсутствие",
        "след",
        "следы",
    }
)


def _is_kgs_sample(sample: Sample) -> bool:
    if (sample.sample_type or "").strip() != SAMPLE_TYPE_PASPORTIZACIYA:
        return False
    obj = (sample.test_object or "").lower()
    return TEST_OBJECT_DEGASSED_CONDENSATE in obj


def _find_sampling_location_prefix(name: str) -> Optional[str]:
    for rx in _KGS_LOCATION_PREFIX_RE:
        match = rx.search(name)
        if match:
            return match.group(1)
    return None


def resolve_kgs_sampling_location_key_and_display(
    raw_name: str,
) -> tuple[str, str]:
    """
    Ключ группы и подпись для столбца B.

    УКПГ-2В и «УКПГ-2В НСПК …» сводятся к «УКПГ-2В»; «ГП-1 ОУПДТ» — к «ОУПДТ».
    """
    name = (raw_name or "").strip()
    if not name:
        return "", REPORT_EMPTY_CELL_VALUE
    lower = name.lower()
    if "оупдт" in lower:
        return "ОУПДТ", "ОУПДТ"
    prefix = _find_sampling_location_prefix(name)
    if prefix:
        return prefix, prefix
    return name, name


def _format_kgs_one_decimal(value: float) -> str:
    """Число в ячейке отчёта: один знак после запятой, у целых — «,0»."""
    rounded = _round_math_one_decimal(value)
    if rounded < 0:
        return f"минус {abs(rounded):.1f}".replace(".", ",")
    return f"{rounded:.1f}".replace(".", ",")


def _format_kgs_cell_display(value: str) -> str:
    if value == REPORT_EMPTY_CELL_VALUE:
        return value
    parsed = _parse_numeric_for_average(value)
    if parsed is not None:
        return _report_display(_format_kgs_one_decimal(parsed))
    text = value.strip().lower()
    if text in ("отс", "отс.") or "отсутств" in text:
        return KGS_ABSENCE_DISPLAY
    return value.strip()


def _parse_numeric_for_average(value: str) -> Optional[float]:
    text = (value or "").strip().lower()
    if text in _TEXT_ZERO_FOR_AVERAGE:
        return None
    if "отсутств" in text or "след" in text:
        return None
    negative = False
    if text.startswith("минус "):
        negative = True
        text = text[6:].strip()
    text = text.replace(" ", "").replace(",", ".")
    try:
        num = float(text)
    except ValueError:
        return None
    return -num if negative else num


def _round_math_one_decimal(value: float) -> float:
    """Округление до одного знака после запятой (математическое, 0,5 вверх)."""
    return float(Decimal(str(value)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def _average_column_values(values: list[str]) -> str:
    """
    Среднее по столбцу группы.

    В расчёте только числовые результаты; пустые, «-», отсутствие, следы не участвуют.
    Если чисел нет — «отсутствие».
    """
    numbers: list[float] = []
    for value in values:
        parsed = _parse_numeric_for_average(value)
        if parsed is not None:
            numbers.append(parsed)
    if not numbers:
        return KGS_ABSENCE_DISPLAY
    mean = sum(numbers) / len(numbers)
    return _format_kgs_one_decimal(mean)


def _kgs_calculation_cell_value(calc: Calculation, spec: MethodColumnSpec) -> str:
    """
    В отчёте КГС для хлористых солей — только число из result,
    без подписей «менее 1,0» / «более 10,0» из input_data.
    """
    if spec.method_name == METHOD_CHLORIDE_SALTS and spec.fractional_field is None:
        raw = (calc.result or "").strip()
        return raw if raw else REPORT_EMPTY_CELL_VALUE
    return _calculation_display_value(calc, spec)


def _find_value_for_column(
    calculations: list[Calculation], spec: MethodColumnSpec
) -> str:
    for calc in calculations:
        if _calculation_matches_spec(calc, spec):
            return _format_kgs_cell_display(_kgs_calculation_cell_value(calc, spec))
    return REPORT_EMPTY_CELL_VALUE


async def _get_samples_for_kgs_report(
    db: AsyncSession,
    laboratory_id: int,
    department_id: Optional[int],
    sampling_date_from: pendulum.DateTime,
    sampling_date_to: pendulum.DateTime,
) -> list[Sample]:
    conditions = [
        Sample.laboratory_id == laboratory_id,
        Sample.deleted_at.is_(None),
        Sample.sampling_location_id.isnot(None),
    ]
    add_date_range_filter(
        conditions, sampling_date_from, sampling_date_to, Sample.sampling_date
    )
    if department_id is not None:
        conditions.append(Sample.department_id == department_id)

    query = (
        select(Sample)
        .join(
            SamplingLocation,
            Sample.sampling_location_id == SamplingLocation.id,
        )
        .where(
            *conditions,
            SamplingLocation.deleted_at.is_(None),
        )
        .options(selectinload(Sample.sampling_location))
    )
    result = await db.execute(query)
    return [s for s in result.scalars().unique().all() if _is_kgs_sample(s)]


@dataclass
class KgsReportDataRow:
    """Строка данных отчёта (не средняя)."""

    location_display: str
    sampling_date: str
    values_by_column: dict[int, str]


@dataclass
class KgsReportAverageRow:
    """Строка средних значений по месту отбора."""

    values_by_column: dict[int, str]


@dataclass
class KgsReportLocationGroup:
    """Группа строк по одному месту отбора."""

    location_display: str
    data_rows: list[KgsReportDataRow]
    average_row: KgsReportAverageRow


async def get_kgs_report_groups(
    db: AsyncSession,
    laboratory_id: int,
    department_id: Optional[int],
    sampling_date_from: pendulum.DateTime,
    sampling_date_to: pendulum.DateTime,
) -> list[KgsReportLocationGroup]:
    """Собирает группы строк отчёта по местам отбора."""
    samples = await _get_samples_for_kgs_report(
        db,
        laboratory_id,
        department_id,
        sampling_date_from,
        sampling_date_to,
    )
    if not samples:
        return []

    grouped: dict[str, list[tuple[str, Sample]]] = {}
    for sample in samples:
        raw = (
            (sample.sampling_location.name or "").strip()
            if sample.sampling_location
            else ""
        )
        key, display = resolve_kgs_sampling_location_key_and_display(raw)
        if not key:
            continue
        grouped.setdefault(key, []).append((display, sample))

    sample_ids = [sample.id for samples in grouped.values() for _, sample in samples]
    calcs_by_sample = await _get_calculations_by_sample(db, sample_ids)

    groups: list[KgsReportLocationGroup] = []
    for key in sorted(grouped.keys(), key=lambda k: grouped[k][0][0]):
        items = grouped[key]
        location_display = items[0][0]
        items.sort(
            key=lambda pair: (
                pair[1].sampling_date is None,
                pair[1].sampling_date or date.min,
                pair[1].id,
            )
        )
        data_rows: list[KgsReportDataRow] = []
        column_values: dict[int, list[str]] = {
            spec.column: [] for spec in KGS_METHOD_COLUMNS
        }

        for _, sample in items:
            calcs = calcs_by_sample.get(sample.id, [])
            values: dict[int, str] = {}
            for spec in KGS_METHOD_COLUMNS:
                cell_value = _find_value_for_column(calcs, spec)
                values[spec.column] = cell_value
                column_values[spec.column].append(cell_value)
            data_rows.append(
                KgsReportDataRow(
                    location_display=location_display,
                    sampling_date=_format_sampling_date(sample.sampling_date),
                    values_by_column=values,
                )
            )

        average_values = {
            col: _average_column_values(column_values[col]) for col in column_values
        }
        groups.append(
            KgsReportLocationGroup(
                location_display=location_display,
                data_rows=data_rows,
                average_row=KgsReportAverageRow(values_by_column=average_values),
            )
        )
    return groups


__all__ = [
    "KGS_METHOD_COLUMNS",
    "KgsReportLocationGroup",
    "format_report_period",
    "get_kgs_report_groups",
    "resolve_kgs_sampling_location_key_and_display",
]
