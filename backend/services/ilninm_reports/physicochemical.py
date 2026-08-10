"""
Данные для отчёта «Физико-химическая характеристика» (ИЛНиНМ).

Пробы за период по дате отбора, место отбора ЦДГГКН №1/№2, объект испытаний «нефть»
(без калибровочной), скважина обязательна. В отчёт попадают только неудалённые расчёты;
метод может быть удалён.
"""

from dataclasses import dataclass
from datetime import date
from typing import Any
import orjson
import pendulum
from sqlalchemy.ext.asyncio import AsyncSession
from models.calculation import Calculation
from models.sample import Sample
from repositories import calculation as calculation_repo, sample as sample_repo
from services.ilninm_reports.constants import (
    FRACTIONAL_RESULT_FIELD_100,
    FRACTIONAL_RESULT_FIELD_150,
    FRACTIONAL_RESULT_FIELD_200,
    FRACTIONAL_RESULT_FIELD_250,
    FRACTIONAL_RESULT_FIELD_270,
    FRACTIONAL_RESULT_FIELD_300,
    FRACTIONAL_RESULT_FIELD_NK,
    GROUP_DENSITY,
    GROUP_FRACTIONAL,
    GROUP_KINEMATIC_VISCOSITY,
    GROUP_MOLECULAR_MASS,
    METHOD_ASPHALTENES,
    METHOD_DENSITY_OIL,
    METHOD_FRACTIONAL_OIL,
    METHOD_FREEZING_TEMP,
    METHOD_MECHANICAL_IMPURITIES,
    METHOD_MOLECULAR_OIL,
    METHOD_PARAFFIN,
    METHOD_PARAFFIN_MELTING,
    METHOD_VISCOSITY_20,
    METHOD_VISCOSITY_50,
    REPORT_EMPTY_CELL_VALUE,
)
from utils.calculation_result_display import format_calculation_result_for_display
from utils.ilninm_constants import DB_NAME_TO_DISPLAY_CDGGKN
from utils.ilninm_sampling_location import resolve_sampling_location_db_name
from utils.protocol_generator_utils import format_decimal_ru


def _report_display(value: str | None) -> str:
    """Пустые и прочерки в ячейках отчёта заменяются на «-»."""
    if value is None:
        return REPORT_EMPTY_CELL_VALUE
    text = str(value).strip()
    if not text or text == REPORT_EMPTY_CELL_VALUE:
        return REPORT_EMPTY_CELL_VALUE
    return text


@dataclass(frozen=True)
class MethodColumnSpec:
    """Столбец отчёта, значение из расчёта по группе и/или методу."""

    column: int
    method_name: str
    group_name: str | None = None
    group_prefix: str | None = None
    fractional_field: str | None = None


METHOD_COLUMNS: tuple[MethodColumnSpec, ...] = (
    MethodColumnSpec(4, METHOD_DENSITY_OIL, GROUP_DENSITY, group_prefix="Плотность при температуре"),
    MethodColumnSpec(5, METHOD_MOLECULAR_OIL, GROUP_MOLECULAR_MASS),
    MethodColumnSpec(6, METHOD_VISCOSITY_20, GROUP_KINEMATIC_VISCOSITY),
    MethodColumnSpec(7, METHOD_VISCOSITY_50, GROUP_KINEMATIC_VISCOSITY),
    MethodColumnSpec(8, METHOD_FREEZING_TEMP, None),
    MethodColumnSpec(
        9,
        METHOD_FRACTIONAL_OIL,
        GROUP_FRACTIONAL,
        fractional_field=FRACTIONAL_RESULT_FIELD_NK,
    ),
    MethodColumnSpec(
        10,
        METHOD_FRACTIONAL_OIL,
        GROUP_FRACTIONAL,
        fractional_field=FRACTIONAL_RESULT_FIELD_100,
    ),
    MethodColumnSpec(
        11,
        METHOD_FRACTIONAL_OIL,
        GROUP_FRACTIONAL,
        fractional_field=FRACTIONAL_RESULT_FIELD_150,
    ),
    MethodColumnSpec(
        12,
        METHOD_FRACTIONAL_OIL,
        GROUP_FRACTIONAL,
        fractional_field=FRACTIONAL_RESULT_FIELD_200,
    ),
    MethodColumnSpec(
        13,
        METHOD_FRACTIONAL_OIL,
        GROUP_FRACTIONAL,
        fractional_field=FRACTIONAL_RESULT_FIELD_250,
    ),
    MethodColumnSpec(
        14,
        METHOD_FRACTIONAL_OIL,
        GROUP_FRACTIONAL,
        fractional_field=FRACTIONAL_RESULT_FIELD_270,
    ),
    MethodColumnSpec(
        15,
        METHOD_FRACTIONAL_OIL,
        GROUP_FRACTIONAL,
        fractional_field=FRACTIONAL_RESULT_FIELD_300,
    ),
    MethodColumnSpec(16, METHOD_ASPHALTENES, None),
    MethodColumnSpec(17, METHOD_MECHANICAL_IMPURITIES, None),
    MethodColumnSpec(18, METHOD_PARAFFIN, None),
    MethodColumnSpec(19, METHOD_PARAFFIN_MELTING, None),
)


def resolve_sampling_location_display(sampling_location: str) -> str:
    """Подпись для шаблона: ЦДГГКН №1 или ЦДГГКН №2."""
    db_name = resolve_sampling_location_db_name(sampling_location)
    return DB_NAME_TO_DISPLAY_CDGGKN.get(db_name, db_name)


def format_report_period(date_from: pendulum.DateTime, date_to: pendulum.DateTime) -> str:
    """Период для метки {period} в шапке отчёта."""
    return f"{date_from.format('DD.MM.YYYY')} - {date_to.format('DD.MM.YYYY')}"


def _normalize_label(value: str | None) -> str:
    if not value:
        return ""
    text = value.strip().lower()
    text = text.replace("℃", "°c")
    return text


def _group_matches(actual_group: str, spec: MethodColumnSpec) -> bool:
    actual = _normalize_label(actual_group)
    if spec.group_prefix:
        prefix = _normalize_label(spec.group_prefix)
        return actual.startswith(prefix) or prefix in actual
    if spec.group_name is None:
        return True
    expected = _normalize_label(spec.group_name)
    if not expected:
        return True
    return actual == expected or expected in actual or actual in expected


def _method_name_matches(actual_name: str, expected_name: str) -> bool:
    return _normalize_label(actual_name) == _normalize_label(expected_name)


def _is_oil_test_object(sample: Sample) -> bool:
    obj = (sample.test_object or "").lower()
    return "нефть" in obj and "калибровочн" not in obj


def _has_well(sample: Sample) -> bool:
    """В отчёт попадают только пробы с заполненной скважиной."""
    return bool((sample.well or "").strip())


def _format_sampling_date(value: date | None) -> str:
    if value is None:
        return REPORT_EMPTY_CELL_VALUE
    return pendulum.instance(value).format("DD.MM.YYYY")


def _parse_calculation_result_payload(calc: Calculation) -> dict[str, Any]:
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


def _fractional_field_value(data: dict[str, Any], field_key: str) -> str:
    value = data.get(field_key, "")
    if (not value or value == "-") and field_key == FRACTIONAL_RESULT_FIELD_NK:
        value = data.get("Температура н,к.", "")
    if value is None or value == "" or value == "-":
        return REPORT_EMPTY_CELL_VALUE
    return _report_display(format_decimal_ru(value))


def _calculation_display_value(calc: Calculation, spec: MethodColumnSpec) -> str:
    if spec.fractional_field:
        data = _parse_calculation_result_payload(calc)
        if "_fractional_data" in data:
            combined: dict[str, Any] = {}
            fractional_data = data.get("_fractional_data") or {}
            if isinstance(fractional_data, dict):
                for card_data in fractional_data.values():
                    if isinstance(card_data, dict):
                        for field, val in card_data.items():
                            if field not in combined or combined[field] in (
                                None,
                                "",
                                "-",
                            ):
                                combined[field] = val
            data = combined
        normalized: dict[str, Any] = {}
        for key, val in data.items():
            normalized[key.replace("Температура н,к.", FRACTIONAL_RESULT_FIELD_NK)] = val
        return _fractional_field_value(normalized, spec.fractional_field)
    method_name = (calc.research_method.name or "") if calc.research_method else ""
    display = format_calculation_result_for_display(calc.result, method_name, calc.input_data)
    if display != str(calc.result if calc.result is not None else ""):
        return _report_display(display)
    return _report_display(format_decimal_ru(calc.result))


def _calculation_matches_spec(calc: Calculation, spec: MethodColumnSpec) -> bool:
    method = calc.research_method
    if method is None:
        return False
    if not _method_name_matches(method.name or "", spec.method_name):
        return False
    if spec.group_name is None and spec.group_prefix is None:
        return True
    groups = method.groups or []
    if not groups:
        if spec.fractional_field and _method_name_matches(method.name or "", METHOD_FRACTIONAL_OIL):
            return True
        return False
    for group in groups:
        if _group_matches(group.name or "", spec):
            return True
    return False


async def _get_samples_for_report(
    db: AsyncSession,
    laboratory_id: int,
    department_id: int | None,
    sampling_date_from: pendulum.DateTime,
    sampling_date_to: pendulum.DateTime,
    sampling_location_db_name: str,
) -> list[Sample]:
    samples = await sample_repo.get_oil_samples_by_sampling_location_name(
        db,
        laboratory_id,
        sampling_location_db_name,
        sampling_date_from,
        sampling_date_to,
        department_id,
    )
    samples = [sample for sample in samples if _is_oil_test_object(sample) and _has_well(sample)]
    samples.sort(
        key=lambda sample: (
            sample.sampling_date is None,
            sample.sampling_date or date.min,
            sample.id,
        )
    )
    return samples


async def get_calculations_by_sample(db: AsyncSession, sample_ids: list[int]) -> dict[int, list[Calculation]]:
    return await calculation_repo.get_calculations_grouped_by_sample_ids(db, sample_ids)


def _find_value_for_column(calculations: list[Calculation], spec: MethodColumnSpec) -> str:
    for calc in calculations:
        if _calculation_matches_spec(calc, spec):
            return _calculation_display_value(calc, spec)
    return REPORT_EMPTY_CELL_VALUE


@dataclass
class PhysicochemicalReportRow:
    """Строка таблицы отчёта (столбцы A-S)."""

    well: str
    sampling_date: str
    values_by_column: dict[int, str]


async def get_physicochemical_report_rows(
    db: AsyncSession,
    laboratory_id: int,
    department_id: int | None,
    sampling_date_from: pendulum.DateTime,
    sampling_date_to: pendulum.DateTime,
    sampling_location: str,
) -> list[PhysicochemicalReportRow]:
    """Собирает строки отчёта по пробам и расчётам за период по дате отбора."""
    db_location = resolve_sampling_location_db_name(sampling_location)
    samples = await _get_samples_for_report(
        db,
        laboratory_id,
        department_id,
        sampling_date_from,
        sampling_date_to,
        db_location,
    )
    if not samples:
        return []

    sample_ids = [s.id for s in samples]
    calcs_by_sample = await get_calculations_by_sample(db, sample_ids)
    rows: list[PhysicochemicalReportRow] = []

    for sample in samples:
        calcs = calcs_by_sample.get(sample.id, [])
        values: dict[int, str] = {}
        for spec in METHOD_COLUMNS:
            values[spec.column] = _find_value_for_column(calcs, spec)
        rows.append(
            PhysicochemicalReportRow(
                well=_report_display((sample.well or "").strip()),
                sampling_date=_format_sampling_date(sample.sampling_date),
                values_by_column=values,
            )
        )
    return rows
