from __future__ import annotations
from collections.abc import Callable
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any
import orjson
from core.exceptions import DomainValidationError
from core.logger import logger
from schemas.calculation import CalculateResponse
from utils.calculation.engine import (
    get_temperature_correction,
    parse_decimal_value,
    round_decimal_half_up,
)
from utils.calculation.fractional_keys import (
    VOLUME_DISTILLATE_FIELD,
    VOLUME_LOSSES_FIELD,
    VOLUME_RESIDUE_FIELD,
    get_fractional_card_value,
    normalize_fractional_key,
)

_CALC_ERRORS = (ArithmeticError, InvalidOperation, TypeError, ValueError, ZeroDivisionError)

CONDENSATE_TEMP_FIELDS: tuple[str, ...] = (
    "Температура н.к.",
    "5% отгона при температуре",
    "10% отгона при температуре",
    "20% отгона при температуре",
    "30% отгона при температуре",
    "40% отгона при температуре",
    "50% отгона при температуре",
    "60% отгона при температуре",
    "70% отгона при температуре",
    "80% отгона при температуре",
    "90% отгона при температуре",
    "95% отгона при температуре",
    "96% отгона при температуре",
    "98% отгона при температуре",
    "Температура к.к.",
)

OIL_TEMP_FIELDS: tuple[str, ...] = (
    "Температура н.к.",
    "10% отгона при температуре",
    "50% отгона при температуре",
)

OIL_OUTPUT_FIELDS: tuple[str, ...] = (
    "100 ℃",
    "120 ℃",
    "150 ℃",
    "160 ℃",
    "180 ℃",
    "200 ℃",
    "220 ℃",
    "240 ℃",
    "250 ℃",
    "260 ℃",
    "270 ℃",
    "280 ℃",
    "300 ℃",
)


def _format_one_decimal_str(value: Any) -> str:
    """Отформатировать число с одним знаком после точки для протокола."""
    return format(round_decimal_half_up(value, 1), ".1f")


def _is_nonempty_numeric(value: Any) -> bool:
    """Проверить, что значение непустое и не ноль."""
    if value is None:
        return False
    if isinstance(value, str) and not value.strip():
        return False
    return str(value).strip() != "0"


def round_to_half(value: Any) -> Decimal:
    """Округлить до ближайшего 0,5 (на границе 0,5 — вверх)."""
    try:
        decimal_value = parse_decimal_value(value)
        return (decimal_value * 2).quantize(Decimal("1"), rounding=ROUND_HALF_UP) / 2
    except _CALC_ERRORS as e:
        raise DomainValidationError(f"Некорректное значение для округления до 0,5: {value!r}") from e


def round_condensate_distillate_volume(value: Any) -> int | Decimal:
    """Округлить объёмную долю отгона конденсата: до 0,25→вниз, от 0,25→0,5, от 0,75→вверх."""
    try:
        val = parse_decimal_value(value)
        integer_part = int(val)
        fractional_part = val - Decimal(integer_part)
        if fractional_part >= Decimal("0.75"):
            return integer_part + 1
        if fractional_part >= Decimal("0.25"):
            return Decimal(integer_part) + Decimal("0.5")
        return integer_part
    except _CALC_ERRORS as e:
        raise DomainValidationError(f"Некорректная объёмная доля отгона: {value!r}") from e


def round_to_one_decimal(value: Any) -> Decimal:
    """Округлить до одного знака после запятой."""
    try:
        return round_decimal_half_up(value, 1)
    except _CALC_ERRORS as e:
        raise DomainValidationError(f"Некорректное значение для округления до 1 знака: {value!r}") from e


def round_half_up_to_int(value: Any) -> int:
    """Округлить до целого (0,5 вверх)."""
    try:
        return int(round_decimal_half_up(value, 0))
    except _CALC_ERRORS as e:
        raise DomainValidationError(f"Некорректное значение для округления до целого: {value!r}") from e


def _extract_parallel_cards(input_data: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Достать данные двух параллелей из `_fractional_data`."""
    fractional_data = input_data.get("_fractional_data")
    if not isinstance(fractional_data, dict):
        raise DomainValidationError("Для фракционного состава нужны данные `_fractional_data`")

    card_1 = fractional_data.get("card1")
    card_2 = fractional_data.get("card2")
    if not isinstance(card_1, dict) or not isinstance(card_2, dict):
        raise DomainValidationError("В `_fractional_data` ожидаются объекты card1 и card2")
    return card_1, card_2


def _correct_temperatures(
    card_data: dict[str, Any],
    field_names: tuple[str, ...],
    patm: Any,
) -> dict[str, Any]:
    """Применить поправку температуры по атмосферному давлению к заполненным полям."""
    corrected: dict[str, Any] = {}
    for field_name in field_names:
        temp_value = card_data.get(field_name, "0")
        if not _is_nonempty_numeric(temp_value):
            corrected[field_name] = temp_value
            continue
        try:
            temp_decimal = parse_decimal_value(temp_value)
            correction = get_temperature_correction(temp_decimal, patm)
            corrected[field_name] = temp_decimal + correction
        except _CALC_ERRORS as e:
            raise DomainValidationError(f"Ошибка поправки температуры для «{field_name}»: {temp_value!r}") from e
    return corrected


def _average_parallel_values(
    values_1: dict[str, Any],
    values_2: dict[str, Any],
    *,
    rounder: Callable[[Any], Any],
) -> dict[str, Any]:
    """Усреднить одноимённые поля двух параллелей и округлить результат."""
    averages: dict[str, Any] = {}
    for field_name in values_1:
        val1 = values_1.get(field_name, 0)
        val2 = values_2.get(field_name, 0)
        try:
            if _is_nonempty_numeric(val1) and _is_nonempty_numeric(val2):
                averages[field_name] = rounder((parse_decimal_value(val1) + parse_decimal_value(val2)) / 2)
            elif _is_nonempty_numeric(val1):
                averages[field_name] = rounder(parse_decimal_value(val1))
            elif _is_nonempty_numeric(val2):
                averages[field_name] = rounder(parse_decimal_value(val2))
        except DomainValidationError:
            raise
        except _CALC_ERRORS as e:
            raise DomainValidationError(f"Ошибка усреднения поля «{field_name}»") from e
    return averages


def _average_optional_pair(
    value_1: Any,
    value_2: Any,
    *,
    rounder: Callable[[Any], Any],
) -> Any | None:
    """Усреднить пару объёмных показателей, если заполнена хотя бы первая параллель."""
    if not _is_nonempty_numeric(value_1):
        return None
    try:
        val1 = parse_decimal_value(value_1)
        if _is_nonempty_numeric(value_2):
            val2 = parse_decimal_value(value_2)
            return rounder((val1 + val2) / 2)
        return rounder(val1)
    except DomainValidationError:
        raise
    except _CALC_ERRORS as e:
        raise DomainValidationError("Ошибка усреднения объёмных долей") from e


def _temps_to_intermediate(average_temps: dict[str, Any]) -> dict[str, str]:
    """Перевести средние температуры в строковые промежуточные результаты."""
    intermediate: dict[str, str] = {}
    for field_name, value in average_temps.items():
        if not _is_nonempty_numeric(value):
            continue
        key = normalize_fractional_key(field_name)
        try:
            intermediate[key] = str(int(parse_decimal_value(value)))
        except _CALC_ERRORS as e:
            raise DomainValidationError(f"Ошибка форматирования температуры «{field_name}»") from e
    return intermediate


def _build_fractional_response(intermediate_results: dict[str, str]) -> CalculateResponse:
    """Собрать ответ расчёта фракционного состава."""
    result_json = orjson.dumps(intermediate_results, option=orjson.OPT_NON_STR_KEYS).decode("utf-8")
    return CalculateResponse.model_validate(
        {
            "convergence": "satisfactory",
            "intermediate_results": intermediate_results,
            "result": result_json,
            "measurement_error": None,
            "unit": "%",
            "conditions_info": [],
            "is_fractional_composition": True,
        }
    )


def calculate_fractional_condensate(input_data: dict[str, Any]) -> CalculateResponse:
    """Посчитать фракционный состав конденсата."""
    logger.info("Начало расчёта фракционного состава конденсата")
    try:
        card_1, card_2 = _extract_parallel_cards(input_data)

        corrected_1 = _correct_temperatures(card_1, CONDENSATE_TEMP_FIELDS, card_1.get("Pатм", "0"))
        corrected_2 = _correct_temperatures(card_2, CONDENSATE_TEMP_FIELDS, card_2.get("Pатм", "0"))
        average_temps = _average_parallel_values(
            corrected_1,
            corrected_2,
            rounder=round_half_up_to_int,
        )

        average_volume_distillate = _average_optional_pair(
            get_fractional_card_value(card_1, VOLUME_DISTILLATE_FIELD),
            get_fractional_card_value(card_2, VOLUME_DISTILLATE_FIELD),
            rounder=round_condensate_distillate_volume,
        )
        average_volume_residue = _average_optional_pair(
            get_fractional_card_value(card_1, VOLUME_RESIDUE_FIELD),
            get_fractional_card_value(card_2, VOLUME_RESIDUE_FIELD),
            rounder=round_to_one_decimal,
        )

        volume_losses = None
        if average_volume_distillate is not None and average_volume_residue is not None:
            volume_losses = round_to_one_decimal(
                Decimal("100")
                - parse_decimal_value(average_volume_distillate)
                - parse_decimal_value(average_volume_residue)
            )

        intermediate_results = _temps_to_intermediate(average_temps)
        if average_volume_distillate is not None:
            intermediate_results[VOLUME_DISTILLATE_FIELD] = _format_one_decimal_str(average_volume_distillate)
        if average_volume_residue is not None:
            intermediate_results[VOLUME_RESIDUE_FIELD] = _format_one_decimal_str(average_volume_residue)
        if volume_losses is not None:
            intermediate_results[VOLUME_LOSSES_FIELD] = _format_one_decimal_str(volume_losses)

        return _build_fractional_response(intermediate_results)
    except DomainValidationError:
        raise
    except _CALC_ERRORS as e:
        logger.error("Ошибка при расчёте фракционного состава конденсата: {}", e)
        raise DomainValidationError(f"Ошибка при расчёте фракционного состава конденсата: {e!s}") from e


def calculate_fractional_oil(input_data: dict[str, Any]) -> CalculateResponse:
    """Посчитать фракционный состав нефти."""
    logger.info("Начало расчёта фракционного состава нефти")
    try:
        card_1, card_2 = _extract_parallel_cards(input_data)

        corrected_1 = _correct_temperatures(card_1, OIL_TEMP_FIELDS, card_1.get("Pатм", "0"))
        corrected_2 = _correct_temperatures(card_2, OIL_TEMP_FIELDS, card_2.get("Pатм", "0"))
        average_temps = _average_parallel_values(
            corrected_1,
            corrected_2,
            rounder=round_half_up_to_int,
        )

        outputs_1 = {name: card_1.get(name, "0") for name in OIL_OUTPUT_FIELDS}
        outputs_2 = {name: card_2.get(name, "0") for name in OIL_OUTPUT_FIELDS}
        average_outputs = _average_parallel_values(
            outputs_1,
            outputs_2,
            rounder=round_to_half,
        )

        intermediate_results = _temps_to_intermediate(average_temps)
        for field_name, value in average_outputs.items():
            if _is_nonempty_numeric(value):
                intermediate_results[f"Выход фракций до {field_name}"] = _format_one_decimal_str(value)

        return _build_fractional_response(intermediate_results)
    except DomainValidationError:
        raise
    except _CALC_ERRORS as e:
        logger.error("Ошибка при расчёте фракционного состава нефти: {}", e)
        raise DomainValidationError(f"Ошибка при расчёте фракционного состава нефти: {e!s}") from e
