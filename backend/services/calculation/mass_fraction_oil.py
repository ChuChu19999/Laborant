from __future__ import annotations
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, NamedTuple
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import DomainValidationError
from core.logger import logger
from repositories import mass_fraction as mass_fraction_repo
from utils.calculation.engine import parse_decimal_value, round_decimal_half_up

MASS_FRACTION_OIL_GROUP_NAME = "Массовая доля нефти"
MF_OIL_DISPLAY_LABELS_KEY = "_mf_oil_display_labels"

_MF_OIL_N_DUPLICATE_OFFSET = Decimal("0.005")


class MassFractionFromRefractionOutcome(NamedTuple):
    """Результат по n: число для формул, строка для input_data; ниже порога — «0,00»."""

    numeric: Decimal
    stored_display: str
    below_detection_limit: bool


def is_mass_fraction_oil_input_key(key: Any) -> bool:
    """Проверить, что ключ — служебное поле массовой доли нефти (_mf_oil…)."""
    return isinstance(key, str) and key.startswith("_mf_oil")


def _has_mass_fraction_oil_group(research_method: dict[str, Any]) -> bool:
    """Проверить, что у методики есть группа массовой доли нефти."""
    group_name = str(research_method.get("group_name") or "").strip()
    if group_name == MASS_FRACTION_OIL_GROUP_NAME:
        return True
    for group in research_method.get("groups") or []:
        if isinstance(group, dict) and str(group.get("name") or "").strip() == MASS_FRACTION_OIL_GROUP_NAME:
            return True
    return False


def is_mass_fraction_oil_method(research_method: dict[str, Any]) -> bool:
    """
    Проверить методику массовой доли нефти по группе или имени метода.

    Если группа другая — учитывать только имя метода.
    """
    if str(research_method.get("name") or "").strip() == MASS_FRACTION_OIL_GROUP_NAME:
        return True
    return _has_mass_fraction_oil_group(research_method)


def _mf_oil_display_from_decimal(value: Decimal) -> str:
    """Отформатировать Decimal массовой доли нефти для отображения."""
    text = format(value.normalize(), "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text.replace(".", ",")


async def calculate_mass_fraction_from_refraction(
    db: AsyncSession, n_value: Any, research_method_id: int
) -> MassFractionFromRefractionOutcome:
    """Вычислить массовую долю нефти (C) по показателю преломления (n) линейной интерполяцией."""
    try:
        n_value = parse_decimal_value(n_value)

        table_entries = await mass_fraction_repo.get_mass_fraction_refraction_entries(db, research_method_id)

        if not table_entries:
            logger.warning(
                "Нет активных точек градуировочного графика для метода {}",
                research_method_id,
            )
            return MassFractionFromRefractionOutcome(Decimal("0"), "0", False)

        n_at_c_zero: list[Decimal] = []
        for entry in table_entries:
            try:
                c_raw = parse_decimal_value(entry.c_value)
                n_raw = parse_decimal_value(entry.n_value)
            except (ValueError, TypeError):
                continue
            if c_raw.copy_abs() < Decimal("1e-12"):
                n_at_c_zero.append(n_raw)

        if n_at_c_zero:
            n_ref = min(n_at_c_zero)
            if n_value < n_ref:
                return MassFractionFromRefractionOutcome(Decimal("0"), "0,00", True)

        points = []
        n_value_counts: dict[Decimal, int] = {}

        for entry in table_entries:
            c_val = parse_decimal_value(entry.c_value)
            n_val = parse_decimal_value(entry.n_value)
            original_n_val = n_val

            if original_n_val in n_value_counts:
                n_value_counts[original_n_val] += 1
                n_val = original_n_val + ((n_value_counts[original_n_val] - 1) * _MF_OIL_N_DUPLICATE_OFFSET)
            else:
                n_value_counts[original_n_val] = 1

            points.append((c_val, n_val))

        points.sort(key=lambda x: x[1])

        min_n = points[0][1]
        max_n = points[-1][1]

        if n_value < min_n:
            return MassFractionFromRefractionOutcome(Decimal("0"), "0", False)
        if n_value > max_n:
            return MassFractionFromRefractionOutcome(Decimal("100"), "100", False)

        for i in range(len(points) - 1):
            n1, c1 = points[i][1], points[i][0]
            n2, c2 = points[i + 1][1], points[i + 1][0]

            if n1 <= n_value <= n2:
                c_result = c1 if n2 == n1 else c1 + (c2 - c1) * (n_value - n1) / (n2 - n1)

                rounded = round_decimal_half_up(c_result, 1)
                return MassFractionFromRefractionOutcome(rounded, _mf_oil_display_from_decimal(rounded), False)

        rounded = round_decimal_half_up(points[-1][0], 1)
        return MassFractionFromRefractionOutcome(rounded, _mf_oil_display_from_decimal(rounded), False)

    except (ArithmeticError, TypeError, ValueError) as e:
        logger.error("Ошибка при расчёте массовой доли нефти: {}", e)
        raise DomainValidationError(f"Ошибка при расчёте массовой доли нефти: {e!s}") from e


async def prepare_mass_fraction_oil_input(
    db: AsyncSession,
    input_data: dict[str, Any],
    research_method: dict[str, Any],
) -> None:
    """Пересчитать C₁/C₂ по n₁/n₂ перед основными формулами методики."""
    if not is_mass_fraction_oil_method(research_method):
        return

    logger.info("Обработка метода массовой доли нефти")
    input_data.pop(MF_OIL_DISPLAY_LABELS_KEY, None)
    mf_oil_display_labels: dict[str, str] = {}

    try:
        method_id = research_method.get("id")
        if not method_id:
            raise DomainValidationError("Не указан ID метода исследования")

        n1_value = input_data.get("n₁") or input_data.get("n1")
        n2_value = input_data.get("n₂") or input_data.get("n2")

        if n1_value and (n1_value != "0" and str(n1_value).strip()):
            c1_key = "C₁" if "C₁" in input_data else "C1"
            c1_out = await calculate_mass_fraction_from_refraction(db, n1_value, method_id)
            input_data[c1_key] = c1_out.stored_display
            if c1_out.below_detection_limit:
                mf_oil_display_labels[c1_key] = "менее 0,1"
            logger.info("Рассчитано C1 по n1 для массовой доли нефти")

        if n2_value and (n2_value != "0" and str(n2_value).strip()):
            c2_key = "C₂" if "C₂" in input_data else "C2"
            c2_out = await calculate_mass_fraction_from_refraction(db, n2_value, method_id)
            input_data[c2_key] = c2_out.stored_display
            if c2_out.below_detection_limit:
                mf_oil_display_labels[c2_key] = "менее 0,1"
            logger.info("Рассчитано C2 по n2 для массовой доли нефти")

        if mf_oil_display_labels:
            input_data[MF_OIL_DISPLAY_LABELS_KEY] = mf_oil_display_labels
    except DomainValidationError:
        raise
    except (ArithmeticError, TypeError, ValueError) as e:
        logger.error("Ошибка при расчёте C1/C2 для массовой доли нефти: {}", e)
        raise DomainValidationError(f"Ошибка при расчёте массовой доли нефти: {e!s}") from e


def _c1_c2_both_zero(variables: dict[str, Any]) -> bool:
    """Проверить, что C₁ и C₂ нулевые после округления в variables."""

    def _to_float(x: Any) -> float:
        if x is None:
            return 0.0
        if isinstance(x, Decimal):
            return float(x)
        if isinstance(x, (int, float)):
            return float(x)
        if isinstance(x, str):
            return float(str(x).replace(",", ".").replace(" ", ""))
        return float(x)

    try:
        c1 = variables.get("C₁")
        if c1 is None:
            c1 = variables.get("C1")
        c2 = variables.get("C₂")
        if c2 is None:
            c2 = variables.get("C2")
        c1 = _to_float(c1)
        c2 = _to_float(c2)
    except (TypeError, ValueError):
        return False
    return abs(c1) < 1e-12 and abs(c2) < 1e-12


def _custom_is_menee_01(custom_value: str | None) -> bool:
    """Проверить подпись условия сходимости «менее 0,1»."""
    if not custom_value:
        return False
    return str(custom_value).strip().casefold() == "менее 0,1".casefold()


def should_skip_repeatability_div_by_sum(
    research_method: dict[str, Any],
    variables: dict[str, Any],
    condition: dict[str, Any],
) -> bool:
    """
    Пропустить условие с (C₁+C₂) в знаменателе при C₁=C₂=0 (деление на ноль).

    Для convergence_value «satisfactory» считать условие выполненным.
    """
    if not is_mass_fraction_oil_method(research_method):
        return False
    if not _c1_c2_both_zero(variables):
        return False
    formula = str(condition.get("formula") or "")
    if "(C₁+C₂)" not in formula and "(C1+C2)" not in formula:
        return False
    convergence_value = condition.get("convergence_value")
    return convergence_value in ("satisfactory", "unsatisfactory")


def log_skip_repeatability_div_by_sum() -> None:
    """Записать в лог пропуск формулы повторяемости при C₁=C₂=0."""
    logger.info(
        "Массовая доля нефти: C₁=C₂=0 — удовлетворительная повторяемость "
        "принята без вычисления формулы с (C₁+C₂) в знаменателе."
    )


def resolve_custom_result_text(
    research_method: dict[str, Any],
    custom_value: str | None,
    intermediate_results_rounded: dict[str, Any],
) -> str | None:
    """Вернуть итог при особом условии «менее 0,1» — Cср или ноль с нужным округлением."""
    if not is_mass_fraction_oil_method(research_method):
        return None
    if not _custom_is_menee_01(custom_value):
        return None

    csr_entry = intermediate_results_rounded.get("Cср")
    if isinstance(csr_entry, dict) and csr_entry.get("value") is not None:
        return str(csr_entry["value"]).replace(".", ",")

    if research_method.get("rounding_type") == "decimal":
        places = research_method.get("rounding_decimal")
        if places is not None:
            zero_d = Decimal("0").quantize(
                Decimal("0.1") ** int(places),
                rounding=ROUND_HALF_UP,
            )
            return str(zero_d).replace(".", ",")
        return "0"

    return "0"
