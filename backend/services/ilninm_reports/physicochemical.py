from __future__ import annotations
from dataclasses import dataclass
from datetime import date
import pendulum
from sqlalchemy.ext.asyncio import AsyncSession
from models.calculation import Calculation
from models.sample import Sample
from repositories import sample as sample_repo
from services.ilninm_reports.common import (
    MethodColumnSpec,
    calculation_display_value,
    calculation_matches_spec,
    format_report_period,
    format_sampling_date,
    get_calculations_grouped_by_sample_ids,
    report_display,
)
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
from utils.ilninm_reports.constants import DB_NAME_TO_DISPLAY_CDGGKN
from utils.ilninm_reports.sampling_location import resolve_sampling_location_db_name

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
    """Вернуть подпись места отбора для шаблона: ЦДГГКН №1 или ЦДГГКН №2."""
    db_name = resolve_sampling_location_db_name(sampling_location)
    return DB_NAME_TO_DISPLAY_CDGGKN.get(db_name, db_name)


def _find_value_for_column(calculations: list[Calculation], spec: MethodColumnSpec) -> str:
    """Вернуть значение расчёта для столбца или прочерк."""
    for calc in calculations:
        if calculation_matches_spec(calc, spec):
            return calculation_display_value(calc, spec)
    return REPORT_EMPTY_CELL_VALUE


async def _get_samples_for_report(
    db: AsyncSession,
    laboratory_id: int,
    department_id: int | None,
    sampling_date_from: pendulum.DateTime,
    sampling_date_to: pendulum.DateTime,
    sampling_location_db_name: str,
) -> list[Sample]:
    """Загрузить пробы нефти по месту отбора и дате отбора за период."""
    samples = await sample_repo.get_oil_samples_by_sampling_location_name(
        db,
        laboratory_id,
        sampling_location_db_name,
        sampling_date_from,
        sampling_date_to,
        department_id,
    )
    samples.sort(
        key=lambda sample: (
            sample.sampling_date is None,
            sample.sampling_date or date.min,
            sample.id,
        )
    )
    return samples


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
    """Собрать строки физико-химического отчёта по пробам и расчётам за период."""
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
    calcs_by_sample = await get_calculations_grouped_by_sample_ids(db, sample_ids)
    rows: list[PhysicochemicalReportRow] = []

    for sample in samples:
        calcs = calcs_by_sample.get(sample.id, [])
        values: dict[int, str] = {}
        for spec in METHOD_COLUMNS:
            values[spec.column] = _find_value_for_column(calcs, spec)
        rows.append(
            PhysicochemicalReportRow(
                well=report_display((sample.well or "").strip()),
                sampling_date=format_sampling_date(sample.sampling_date),
                values_by_column=values,
            )
        )
    return rows


__all__ = [
    "METHOD_COLUMNS",
    "MethodColumnSpec",
    "PhysicochemicalReportRow",
    "format_report_period",
    "get_physicochemical_report_rows",
    "resolve_sampling_location_display",
]
