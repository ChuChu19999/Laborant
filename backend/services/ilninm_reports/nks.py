"""
Данные для отчёта «Результаты НКС» (ИЛНиНМ).

Пробы за период по дате отбора: объект «нефтеконденсатная смесь», не удалённые.
"""

from dataclasses import dataclass
from datetime import date
from typing import Any, Optional
import pendulum
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.calculation import Calculation
from models.sample import Sample
from services.ilninm_reports.constants import (
    GROUP_DENSITY_20,
    GROUP_MASS_FRACTION_OIL,
    METHOD_FRACTIONAL_CONDENSATE,
    METHOD_MASS_FRACTION_OIL,
    NKS_COL_COLOR,
    NKS_COL_DENSITY,
    NKS_COL_FS_10,
    NKS_COL_FS_50,
    NKS_COL_FS_90,
    NKS_COL_FS_DISTILLATE,
    NKS_COL_FS_END,
    NKS_COL_FS_LOSSES,
    NKS_COL_FS_RESIDUE,
    NKS_COL_FS_START,
    NKS_COL_LAB_ACTIVITY,
    NKS_COL_MASS_FRACTION,
    NKS_COL_MEASUREMENT_ERROR,
    NKS_COL_PLUS_MINUS,
    NKS_COL_PRESSURE,
    NKS_COL_TEMPERATURE,
    NKS_FS_FIELD_10,
    NKS_FS_FIELD_50,
    NKS_FS_FIELD_90,
    NKS_FS_FIELD_DISTILLATE,
    NKS_FS_FIELD_END_BOIL,
    NKS_FS_FIELD_LOSSES,
    NKS_FS_FIELD_NK,
    NKS_FS_FIELD_RESIDUE,
    NKS_MF_OIL_COLOR_FIELD,
    REPORT_EMPTY_CELL_VALUE,
    TEST_OBJECT_NKS_MIXTURE,
)
from services.ilninm_reports.physicochemical import (
    _format_sampling_date,
    _get_calculations_by_sample,
    _method_name_matches,
    _parse_calculation_result_payload,
    _report_display,
    format_report_period,
)
from utils.calculation_result_display import format_calculation_result_for_display
from utils.filters import add_date_range_filter

_NKS_TEMPERATURE_CAP = 360
_Q_ZERO_EPSILON = 1e-9


@dataclass
class NksReportRow:
    """Строка отчёта НКС (столбцы A–S)."""

    row_index: int
    well: str
    sampling_date: str
    values_by_column: dict[int, str]


def _is_nks_sample(sample: Sample) -> bool:
    return TEST_OBJECT_NKS_MIXTURE in (sample.test_object or "").lower()


def _selection_condition_raw(sample: Sample, variable_name: str) -> Optional[str]:
    raw = sample.selection_conditions
    if not raw:
        return None
    if isinstance(raw, dict):
        if "conditions" in raw:
            items = raw.get("conditions") or []
            if isinstance(items, list):
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    var = (item.get("variable") or "").strip()
                    if var == variable_name:
                        val = item.get("value")
                        return str(val).strip() if val is not None else None
        else:
            val = raw.get(variable_name)
            if val is not None and str(val).strip():
                return str(val).strip()
    if isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict):
                continue
            var = (item.get("variable") or "").strip()
            if var == variable_name:
                val = item.get("value")
                return str(val).strip() if val is not None else None
    return None


def _format_selection_condition(value: Optional[str]) -> str:
    if value is None or not str(value).strip():
        return REPORT_EMPTY_CELL_VALUE
    return str(value).strip().replace(".", ",")


def _normalize_group_label(value: str) -> str:
    text = (value or "").strip().lower()
    return text.replace("℃", "°c")


def _group_name_matches(actual: str, expected: str) -> bool:
    """Сопоставление имени группы методов (строка, не MethodColumnSpec)."""
    actual_n = _normalize_group_label(actual)
    expected_n = _normalize_group_label(expected)
    if not expected_n:
        return False
    return actual_n == expected_n or expected_n in actual_n or actual_n in expected_n


def _format_lab_activity_dates(calculations: list[Calculation]) -> str:
    dates: list[date] = []
    for calc in calculations:
        if calc.laboratory_activity_date:
            dates.append(calc.laboratory_activity_date)
    if not dates:
        return REPORT_EMPTY_CELL_VALUE
    min_date = min(dates)
    max_date = max(dates)
    min_text = pendulum.instance(min_date).format("DD.MM.YYYY")
    max_text = pendulum.instance(max_date).format("DD.MM.YYYY")
    if min_text == max_text:
        return min_text
    return f"{min_text}-{max_text}"


def _calc_in_group(calc: Calculation, group_name: str) -> bool:
    method = calc.research_method
    if method is None:
        return False
    for group in method.groups or []:
        name = str(getattr(group, "name", "") or "")
        if _group_name_matches(name, group_name):
            return True
        if group_name == GROUP_DENSITY_20 and name.startswith(
            "Плотность при температуре"
        ):
            return True
    return False


def _find_first_mass_fraction_oil_calc(
    calculations: list[Calculation],
) -> Optional[Calculation]:
    for calc in calculations:
        method = calc.research_method
        if method is None:
            continue
        if _method_name_matches(method.name or "", METHOD_MASS_FRACTION_OIL):
            return calc
        if _calc_in_group(calc, GROUP_MASS_FRACTION_OIL):
            return calc
    return None


def _find_first_density_20_calc(
    calculations: list[Calculation],
) -> Optional[Calculation]:
    for calc in calculations:
        if _calc_in_group(calc, GROUP_DENSITY_20):
            return calc
    return None


def _find_first_fractional_condensate_calc(
    calculations: list[Calculation],
) -> Optional[Calculation]:
    for calc in calculations:
        method_name = (calc.research_method.name or "") if calc.research_method else ""
        if _method_name_matches(method_name, METHOD_FRACTIONAL_CONDENSATE):
            return calc
    return None


def _input_data_dict(calc: Calculation) -> dict[str, Any]:
    raw = calc.input_data
    if isinstance(raw, dict):
        return raw
    return {}


def _mf_oil_color(calc: Calculation) -> str:
    value = _input_data_dict(calc).get(NKS_MF_OIL_COLOR_FIELD)
    if value is None or str(value).strip() in ("", "-"):
        return REPORT_EMPTY_CELL_VALUE
    return _report_display(str(value).strip())


def _fractional_payload(calc: Calculation) -> dict[str, Any]:
    data = _parse_calculation_result_payload(calc)
    if "_fractional_data" not in data:
        return data
    combined: dict[str, Any] = {}
    fractional_data = data.get("_fractional_data") or {}
    if isinstance(fractional_data, dict):
        for card_data in fractional_data.values():
            if isinstance(card_data, dict):
                for field, val in card_data.items():
                    if field not in combined or combined[field] in (None, "", "-"):
                        combined[field] = val
    normalized: dict[str, Any] = {}
    for key, val in combined.items():
        normalized[key.replace("Температура н,к.", NKS_FS_FIELD_NK)] = val
    return normalized


def _fractional_field_raw(calc: Calculation, field_name: str) -> Optional[str]:
    data = _fractional_payload(calc)
    if not data:
        data = _parse_calculation_result_payload(calc)
    for key, val in data.items():
        norm = key.replace("Температура н,к.", NKS_FS_FIELD_NK)
        if norm == field_name or key == field_name:
            if val is None or str(val).strip() in ("", "-"):
                return None
            return str(val).strip()
    return None


def _try_parse_number(text: str) -> Optional[float]:
    cleaned = (text or "").strip()
    if not cleaned or cleaned == REPORT_EMPTY_CELL_VALUE:
        return None
    lower = cleaned.lower()
    if lower.startswith("менее ") or lower.startswith("более "):
        cleaned = cleaned.split(" ", 1)[-1].strip()
    if "±" in cleaned:
        cleaned = cleaned.split("±", 1)[0].strip()
    cleaned = cleaned.replace(" ", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _format_nks_numeric(
    value: Any,
    *,
    cap_temperature: bool = False,
) -> str:
    if value is None:
        return REPORT_EMPTY_CELL_VALUE
    text = str(value).strip()
    if not text or text == REPORT_EMPTY_CELL_VALUE:
        return REPORT_EMPTY_CELL_VALUE
    lower = text.lower()
    if lower.startswith("менее ") or lower.startswith("более "):
        return text.replace(".", ",")
    num = _try_parse_number(text)
    if num is None:
        return _report_display(text.replace(".", ","))
    if cap_temperature and num > _NKS_TEMPERATURE_CAP:
        return f">{_NKS_TEMPERATURE_CAP}"
    if num == int(num):
        return f"{int(num)},0"
    rendered = str(num).replace(".", ",")
    return _report_display(rendered)


def _format_nks_q(calc: Calculation) -> str:
    raw = calc.result
    if raw is None or str(raw).strip() in ("", "-"):
        return REPORT_EMPTY_CELL_VALUE
    text = str(raw).strip()
    display = format_calculation_result_for_display(
        raw, METHOD_MASS_FRACTION_OIL, calc.input_data
    )
    if display != text:
        return _report_display(display.replace(".", ","))
    num = _try_parse_number(text)
    if num is None:
        return _report_display(text.replace(".", ","))
    return f"{num:.2f}".replace(".", ",")


def _is_q_zero(q_display: str) -> bool:
    num = _try_parse_number(q_display)
    if num is None:
        return False
    return abs(num) < _Q_ZERO_EPSILON


def _density_result(calc: Calculation) -> str:
    method_name = (calc.research_method.name or "") if calc.research_method else ""
    display = format_calculation_result_for_display(
        calc.result, method_name, calc.input_data
    )
    if display != str(calc.result if calc.result is not None else ""):
        return _format_nks_numeric(display, cap_temperature=False)
    return _format_nks_numeric(calc.result, cap_temperature=False)


def _build_mass_fraction_columns(
    calc: Optional[Calculation],
) -> tuple[str, str, str]:
    """Q, R, S — массовая доля нефти, знак ±, погрешность."""
    if calc is None:
        return REPORT_EMPTY_CELL_VALUE, "", REPORT_EMPTY_CELL_VALUE
    q_text = _format_nks_q(calc)
    if _is_q_zero(q_text):
        return q_text, "", REPORT_EMPTY_CELL_VALUE
    r_text = "±"
    error = (calc.measurement_error or "").strip()
    s_text = error if error else REPORT_EMPTY_CELL_VALUE
    return q_text, r_text, s_text


def _build_row_values(calculations: list[Calculation]) -> dict[int, str]:
    values: dict[int, str] = {}

    mf_calc = _find_first_mass_fraction_oil_calc(calculations)
    density_calc = _find_first_density_20_calc(calculations)
    fs_calc = _find_first_fractional_condensate_calc(calculations)

    values[NKS_COL_LAB_ACTIVITY] = _format_lab_activity_dates(calculations)

    if mf_calc:
        values[NKS_COL_COLOR] = _mf_oil_color(mf_calc)
    else:
        values[NKS_COL_COLOR] = REPORT_EMPTY_CELL_VALUE

    if density_calc:
        values[NKS_COL_DENSITY] = _density_result(density_calc)
    else:
        values[NKS_COL_DENSITY] = REPORT_EMPTY_CELL_VALUE

    fs_fields = (
        (NKS_COL_FS_START, NKS_FS_FIELD_NK),
        (NKS_COL_FS_10, NKS_FS_FIELD_10),
        (NKS_COL_FS_50, NKS_FS_FIELD_50),
        (NKS_COL_FS_90, NKS_FS_FIELD_90),
        (NKS_COL_FS_END, NKS_FS_FIELD_END_BOIL),
        (NKS_COL_FS_DISTILLATE, NKS_FS_FIELD_DISTILLATE),
        (NKS_COL_FS_RESIDUE, NKS_FS_FIELD_RESIDUE),
        (NKS_COL_FS_LOSSES, NKS_FS_FIELD_LOSSES),
    )
    if fs_calc:
        for col, field in fs_fields:
            raw = _fractional_field_raw(fs_calc, field)
            is_temperature = field in (
                NKS_FS_FIELD_NK,
                NKS_FS_FIELD_10,
                NKS_FS_FIELD_50,
                NKS_FS_FIELD_90,
                NKS_FS_FIELD_END_BOIL,
            )
            values[col] = _format_nks_numeric(raw, cap_temperature=is_temperature)
    else:
        for col, _field in fs_fields:
            values[col] = REPORT_EMPTY_CELL_VALUE

    q_text, r_text, s_text = _build_mass_fraction_columns(mf_calc)
    values[NKS_COL_MASS_FRACTION] = q_text
    values[NKS_COL_PLUS_MINUS] = r_text
    values[NKS_COL_MEASUREMENT_ERROR] = s_text

    return values


async def _get_samples_for_nks_report(
    db: AsyncSession,
    laboratory_id: int,
    department_id: Optional[int],
    sampling_date_from: pendulum.DateTime,
    sampling_date_to: pendulum.DateTime,
) -> list[Sample]:
    conditions = [
        Sample.laboratory_id == laboratory_id,
        Sample.deleted_at.is_(None),
    ]
    add_date_range_filter(
        conditions, sampling_date_from, sampling_date_to, Sample.sampling_date
    )
    if department_id is not None:
        conditions.append(Sample.department_id == department_id)

    query = select(Sample).where(*conditions)
    result = await db.execute(query)
    samples = [s for s in result.scalars().unique().all() if _is_nks_sample(s)]
    samples.sort(
        key=lambda s: (
            s.sampling_date is None,
            s.sampling_date or date.min,
            (s.well or "").strip(),
            s.id,
        )
    )
    return samples


async def get_nks_report_rows(
    db: AsyncSession,
    laboratory_id: int,
    department_id: Optional[int],
    sampling_date_from: pendulum.DateTime,
    sampling_date_to: pendulum.DateTime,
) -> list[NksReportRow]:
    """Собирает строки отчёта НКС по пробам за период."""
    samples = await _get_samples_for_nks_report(
        db,
        laboratory_id,
        department_id,
        sampling_date_from,
        sampling_date_to,
    )
    if not samples:
        return []

    calcs_by_sample = await _get_calculations_by_sample(db, [s.id for s in samples])
    rows: list[NksReportRow] = []
    for index, sample in enumerate(samples, start=1):
        calcs = calcs_by_sample.get(sample.id, [])
        values = _build_row_values(calcs)
        values[NKS_COL_PRESSURE] = _format_selection_condition(
            _selection_condition_raw(sample, "Давление")
        )
        values[NKS_COL_TEMPERATURE] = _format_selection_condition(
            _selection_condition_raw(sample, "Температура")
        )
        well = (sample.well or "").strip()
        rows.append(
            NksReportRow(
                row_index=index,
                well=_report_display(well) if well else REPORT_EMPTY_CELL_VALUE,
                sampling_date=_format_sampling_date(sample.sampling_date),
                values_by_column=values,
            )
        )
    return rows


__all__ = [
    "NksReportRow",
    "format_report_period",
    "get_nks_report_rows",
]
