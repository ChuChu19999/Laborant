from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any
import orjson
from core.logger import logger
from utils.calculation_engine import (
    get_temperature_correction,
    parse_decimal_value,
    round_decimal_half_up,
)


def _format_one_decimal_str(value: Any) -> str:
    """Одна цифра после запятой для протокола."""
    return format(round_decimal_half_up(value, 1), ".1f")


def _is_nonempty_numeric(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str) and not value.strip():
        return False
    return str(value).strip() != "0"


def round_to_half(value: Any) -> Decimal:
    """Округляет до ближайшего 0,5 математически (0,5 вверх на границе)."""
    try:
        decimal_value = parse_decimal_value(value)
        return (decimal_value * 2).quantize(Decimal("1"), rounding=ROUND_HALF_UP) / 2
    except (ValueError, TypeError, InvalidOperation):
        return value


def round_condensate_distillate_volume(value: Any) -> int | Decimal:
    """Округление объемной доли отгона в фракционке конденсата."""
    try:
        val = parse_decimal_value(value)
        integer_part = int(val)
        fractional_part = val - Decimal(integer_part)
        if fractional_part >= Decimal("0.75"):
            return integer_part + 1
        if fractional_part >= Decimal("0.25"):
            return Decimal(integer_part) + Decimal("0.5")
        return integer_part
    except (ValueError, TypeError, InvalidOperation):
        return value


def round_to_one_decimal(value: Any) -> Decimal:
    """Округляет до 1 знака после запятой."""
    try:
        return round_decimal_half_up(value, 1)
    except (ValueError, TypeError, InvalidOperation):
        return value


def round_half_up_to_int(value: Any) -> int:
    """Округляет до целого по правилу 0.5 вверх."""
    try:
        return int(round_decimal_half_up(value, 0))
    except (ValueError, TypeError, InvalidOperation):
        return int(value) if value not in (None, "") else 0


def calculate_fractional_composition(input_data: dict[str, Any]) -> dict[str, Any]:
    """Специальная функция для расчета фракционного состава конденсата."""
    try:
        logger.info("Начало расчета фракционного состава конденсата")

        # Обрабатываем данные по card_index
        if "_fractional_data" in input_data:
            fractional_data = input_data["_fractional_data"]
            card_1_data = fractional_data.get("card1", {})
            card_2_data = fractional_data.get("card2", {})
            logger.info("Используем специальную структуру данных для фракционного состава")
        else:
            # Старая логика для обратной совместимости
            card_1_data = {}
            card_2_data = {}

            parallel_1_fields = [
                "Pатм",
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
                "Объемная доля отгона",
                "Объемная доля остатка",
            ]

            field_count = {}
            for key, value in input_data.items():
                if key in parallel_1_fields:
                    if key not in field_count:
                        field_count[key] = 0
                    field_count[key] += 1

                    if field_count[key] == 1:
                        card_1_data[key] = value
                    elif field_count[key] == 2:
                        card_2_data[key] = value

        # Получаем данные для первой и второй параллели
        patm1 = card_1_data.get("Pатм", "0")
        temp_fields_1 = [
            ("Температура н.к.", card_1_data.get("Температура н.к.", "0")),
            (
                "5% отгона при температуре",
                card_1_data.get("5% отгона при температуре", "0"),
            ),
            (
                "10% отгона при температуре",
                card_1_data.get("10% отгона при температуре", "0"),
            ),
            (
                "20% отгона при температуре",
                card_1_data.get("20% отгона при температуре", "0"),
            ),
            (
                "30% отгона при температуре",
                card_1_data.get("30% отгона при температуре", "0"),
            ),
            (
                "40% отгона при температуре",
                card_1_data.get("40% отгона при температуре", "0"),
            ),
            (
                "50% отгона при температуре",
                card_1_data.get("50% отгона при температуре", "0"),
            ),
            (
                "60% отгона при температуре",
                card_1_data.get("60% отгона при температуре", "0"),
            ),
            (
                "70% отгона при температуре",
                card_1_data.get("70% отгона при температуре", "0"),
            ),
            (
                "80% отгона при температуре",
                card_1_data.get("80% отгона при температуре", "0"),
            ),
            (
                "90% отгона при температуре",
                card_1_data.get("90% отгона при температуре", "0"),
            ),
            (
                "95% отгона при температуре",
                card_1_data.get("95% отгона при температуре", "0"),
            ),
            (
                "96% отгона при температуре",
                card_1_data.get("96% отгона при температуре", "0"),
            ),
            (
                "98% отгона при температуре",
                card_1_data.get("98% отгона при температуре", "0"),
            ),
            ("Температура к.к.", card_1_data.get("Температура к.к.", "0")),
        ]

        patm2 = card_2_data.get("Pатм", "0")
        temp_fields_2 = [
            ("Температура н.к.", card_2_data.get("Температура н.к.", "0")),
            (
                "5% отгона при температуре",
                card_2_data.get("5% отгона при температуре", "0"),
            ),
            (
                "10% отгона при температуре",
                card_2_data.get("10% отгона при температуре", "0"),
            ),
            (
                "20% отгона при температуре",
                card_2_data.get("20% отгона при температуре", "0"),
            ),
            (
                "30% отгона при температуре",
                card_2_data.get("30% отгона при температуре", "0"),
            ),
            (
                "40% отгона при температуре",
                card_2_data.get("40% отгона при температуре", "0"),
            ),
            (
                "50% отгона при температуре",
                card_2_data.get("50% отгона при температуре", "0"),
            ),
            (
                "60% отгона при температуре",
                card_2_data.get("60% отгона при температуре", "0"),
            ),
            (
                "70% отгона при температуре",
                card_2_data.get("70% отгона при температуре", "0"),
            ),
            (
                "80% отгона при температуре",
                card_2_data.get("80% отгона при температуре", "0"),
            ),
            (
                "90% отгона при температуре",
                card_2_data.get("90% отгона при температуре", "0"),
            ),
            (
                "95% отгона при температуре",
                card_2_data.get("95% отгона при температуре", "0"),
            ),
            (
                "96% отгона при температуре",
                card_2_data.get("96% отгона при температуре", "0"),
            ),
            (
                "98% отгона при температуре",
                card_2_data.get("98% отгона при температуре", "0"),
            ),
            ("Температура к.к.", card_2_data.get("Температура к.к.", "0")),
        ]

        volume_distillate1 = card_1_data.get("Объемная доля отгона", "0")
        volume_residue1 = card_1_data.get("Объемная доля остатка", "0")
        volume_distillate2 = card_2_data.get("Объемная доля отгона", "0")
        volume_residue2 = card_2_data.get("Объемная доля остатка", "0")

        corrected_temps_1 = {}
        for field_name, temp_value in temp_fields_1:
            if _is_nonempty_numeric(temp_value):
                try:
                    temp_decimal = parse_decimal_value(temp_value)
                    correction = get_temperature_correction(temp_decimal, patm1)
                    corrected_temps_1[field_name] = temp_decimal + correction
                except (ValueError, TypeError):
                    corrected_temps_1[field_name] = temp_value
            else:
                corrected_temps_1[field_name] = temp_value

        corrected_temps_2 = {}
        for field_name, temp_value in temp_fields_2:
            if _is_nonempty_numeric(temp_value):
                try:
                    temp_decimal = parse_decimal_value(temp_value)
                    correction = get_temperature_correction(temp_decimal, patm2)
                    corrected_temps_2[field_name] = temp_decimal + correction
                except (ValueError, TypeError):
                    corrected_temps_2[field_name] = temp_value
            else:
                corrected_temps_2[field_name] = temp_value

        average_temps = {}
        for field_name in corrected_temps_1:
            val1 = corrected_temps_1.get(field_name, 0)
            val2 = corrected_temps_2.get(field_name, 0)

            if _is_nonempty_numeric(val1) and _is_nonempty_numeric(val2):
                try:
                    avg_val = (parse_decimal_value(val1) + parse_decimal_value(val2)) / 2
                    average_temps[field_name] = round_half_up_to_int(avg_val)
                except (ValueError, TypeError):
                    average_temps[field_name] = val1
            elif _is_nonempty_numeric(val1):
                try:
                    average_temps[field_name] = round_half_up_to_int(parse_decimal_value(val1))
                except (ValueError, TypeError):
                    average_temps[field_name] = val1
            elif _is_nonempty_numeric(val2):
                try:
                    average_temps[field_name] = round_half_up_to_int(parse_decimal_value(val2))
                except (ValueError, TypeError):
                    average_temps[field_name] = val2

        average_volume_distillate = None
        average_volume_residue = None

        if _is_nonempty_numeric(volume_distillate1):
            try:
                val1 = parse_decimal_value(volume_distillate1)
                if _is_nonempty_numeric(volume_distillate2):
                    val2 = parse_decimal_value(volume_distillate2)
                    average_volume_distillate = round_condensate_distillate_volume((val1 + val2) / 2)
                else:
                    average_volume_distillate = round_condensate_distillate_volume(val1)
            except (ValueError, TypeError):
                pass

        if _is_nonempty_numeric(volume_residue1):
            try:
                val1 = parse_decimal_value(volume_residue1)
                if _is_nonempty_numeric(volume_residue2):
                    val2 = parse_decimal_value(volume_residue2)
                    average_volume_residue = round_to_one_decimal((val1 + val2) / 2)
                else:
                    average_volume_residue = round_to_one_decimal(val1)
            except (ValueError, TypeError):
                pass

        volume_losses = None
        if average_volume_distillate is not None and average_volume_residue is not None:
            try:
                distillate_val = parse_decimal_value(average_volume_distillate)
                residue_val = parse_decimal_value(average_volume_residue)
                volume_losses = round_to_one_decimal(Decimal("100") - distillate_val - residue_val)
            except (ValueError, TypeError):
                pass

        # Формируем промежуточные результаты
        intermediate_results = {}

        for field_name, value in average_temps.items():
            if _is_nonempty_numeric(value):
                if any(
                    temp_keyword in field_name.lower() for temp_keyword in ["температура", "отгона при температуре"]
                ):
                    try:
                        int_value = int(parse_decimal_value(value))
                        normalized_key = field_name.replace("Температура н,к.", "Температура н.к.")
                        intermediate_results[normalized_key] = str(int_value)
                    except (ValueError, TypeError):
                        normalized_key = field_name.replace("Температура н,к.", "Температура н.к.")
                        intermediate_results[normalized_key] = str(value)

        if average_volume_distillate is not None:
            intermediate_results["Объемная доля отгона"] = _format_one_decimal_str(average_volume_distillate)
        if average_volume_residue is not None:
            intermediate_results["Объемная доля остатка"] = _format_one_decimal_str(average_volume_residue)
        if volume_losses is not None:
            intermediate_results["Объемная доля потерь"] = _format_one_decimal_str(volume_losses)

        result_json = orjson.dumps(intermediate_results, option=orjson.OPT_NON_STR_KEYS).decode("utf-8")

        return {
            "convergence": "satisfactory",
            "intermediate_results": intermediate_results,
            "result": result_json,
            "measurement_error": None,
            "unit": "%",
            "conditions_info": [],
            "is_fractional_composition": True,
        }

    except Exception as e:
        logger.error(f"Ошибка при расчете фракционного состава: {e!s}")
        raise ValueError(f"Ошибка при расчете фракционного состава: {e!s}")


def calculate_fractional_composition_oil(input_data: dict[str, Any]) -> dict[str, Any]:
    """Специальная функция для расчета фракционного состава нефти."""
    try:
        logger.info("Начало расчета фракционного состава нефти")

        if "_fractional_data" in input_data:
            fractional_data = input_data["_fractional_data"]
            card_1_data = fractional_data.get("card1", {})
            card_2_data = fractional_data.get("card2", {})
        else:
            card_1_data = {}
            card_2_data = {}

            parallel_1_fields = [
                "Pатм",
                "Температура н.к.",
                "10% отгона при температуре",
                "50% отгона при температуре",
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
            ]

            field_count = {}
            for key, value in input_data.items():
                if key in parallel_1_fields:
                    if key not in field_count:
                        field_count[key] = 0
                    field_count[key] += 1

                    if field_count[key] == 1:
                        card_1_data[key] = value
                    elif field_count[key] == 2:
                        card_2_data[key] = value

        # Получаем давление для первой и второй параллели
        patm1 = card_1_data.get("Pатм", "0")
        patm2 = card_2_data.get("Pатм", "0")

        # Получаем данные для первой и второй параллели
        temp_fields_1 = [
            ("Температура н.к.", card_1_data.get("Температура н.к.", "0")),
            (
                "10% отгона при температуре",
                card_1_data.get("10% отгона при температуре", "0"),
            ),
            (
                "50% отгона при температуре",
                card_1_data.get("50% отгона при температуре", "0"),
            ),
        ]

        temp_fields_2 = [
            ("Температура н.к.", card_2_data.get("Температура н.к.", "0")),
            (
                "10% отгона при температуре",
                card_2_data.get("10% отгона при температуре", "0"),
            ),
            (
                "50% отгона при температуре",
                card_2_data.get("50% отгона при температуре", "0"),
            ),
        ]

        corrected_temps_1 = {}
        for field_name, temp_value in temp_fields_1:
            if _is_nonempty_numeric(temp_value):
                try:
                    temp_decimal = parse_decimal_value(temp_value)
                    correction = get_temperature_correction(temp_decimal, patm1)
                    corrected_temps_1[field_name] = temp_decimal + correction
                except (ValueError, TypeError):
                    corrected_temps_1[field_name] = temp_value
            else:
                corrected_temps_1[field_name] = temp_value

        corrected_temps_2 = {}
        for field_name, temp_value in temp_fields_2:
            if _is_nonempty_numeric(temp_value):
                try:
                    temp_decimal = parse_decimal_value(temp_value)
                    correction = get_temperature_correction(temp_decimal, patm2)
                    corrected_temps_2[field_name] = temp_decimal + correction
                except (ValueError, TypeError):
                    corrected_temps_2[field_name] = temp_value
            else:
                corrected_temps_2[field_name] = temp_value

        output_fields_1 = [
            ("100 ℃", card_1_data.get("100 ℃", "0")),
            ("120 ℃", card_1_data.get("120 ℃", "0")),
            ("150 ℃", card_1_data.get("150 ℃", "0")),
            ("160 ℃", card_1_data.get("160 ℃", "0")),
            ("180 ℃", card_1_data.get("180 ℃", "0")),
            ("200 ℃", card_1_data.get("200 ℃", "0")),
            ("220 ℃", card_1_data.get("220 ℃", "0")),
            ("240 ℃", card_1_data.get("240 ℃", "0")),
            ("250 ℃", card_1_data.get("250 ℃", "0")),
            ("260 ℃", card_1_data.get("260 ℃", "0")),
            ("270 ℃", card_1_data.get("270 ℃", "0")),
            ("280 ℃", card_1_data.get("280 ℃", "0")),
            ("300 ℃", card_1_data.get("300 ℃", "0")),
        ]

        output_fields_2 = [
            ("100 ℃", card_2_data.get("100 ℃", "0")),
            ("120 ℃", card_2_data.get("120 ℃", "0")),
            ("150 ℃", card_2_data.get("150 ℃", "0")),
            ("160 ℃", card_2_data.get("160 ℃", "0")),
            ("180 ℃", card_2_data.get("180 ℃", "0")),
            ("200 ℃", card_2_data.get("200 ℃", "0")),
            ("220 ℃", card_2_data.get("220 ℃", "0")),
            ("240 ℃", card_2_data.get("240 ℃", "0")),
            ("250 ℃", card_2_data.get("250 ℃", "0")),
            ("260 ℃", card_2_data.get("260 ℃", "0")),
            ("270 ℃", card_2_data.get("270 ℃", "0")),
            ("280 ℃", card_2_data.get("280 ℃", "0")),
            ("300 ℃", card_2_data.get("300 ℃", "0")),
        ]

        average_temps = {}
        for field_name in corrected_temps_1:
            val1 = corrected_temps_1.get(field_name, 0)
            val2 = corrected_temps_2.get(field_name, 0)

            if _is_nonempty_numeric(val1) and _is_nonempty_numeric(val2):
                try:
                    avg_val = (parse_decimal_value(val1) + parse_decimal_value(val2)) / 2
                    average_temps[field_name] = round_half_up_to_int(avg_val)
                except (ValueError, TypeError):
                    average_temps[field_name] = val1
            elif _is_nonempty_numeric(val1):
                try:
                    average_temps[field_name] = round_half_up_to_int(parse_decimal_value(val1))
                except (ValueError, TypeError):
                    average_temps[field_name] = val1
            elif _is_nonempty_numeric(val2):
                try:
                    average_temps[field_name] = round_half_up_to_int(parse_decimal_value(val2))
                except (ValueError, TypeError):
                    average_temps[field_name] = val2

        average_outputs = {}
        for field_name, val1 in output_fields_1:
            val2 = output_fields_2[output_fields_1.index((field_name, val1))][1]

            if _is_nonempty_numeric(val1) and _is_nonempty_numeric(val2):
                try:
                    avg_val = (parse_decimal_value(val1) + parse_decimal_value(val2)) / 2
                    average_outputs[field_name] = round_to_half(avg_val)
                except (ValueError, TypeError):
                    average_outputs[field_name] = val1
            elif _is_nonempty_numeric(val1):
                try:
                    average_outputs[field_name] = round_to_half(parse_decimal_value(val1))
                except (ValueError, TypeError):
                    average_outputs[field_name] = val1
            elif _is_nonempty_numeric(val2):
                try:
                    average_outputs[field_name] = round_to_half(parse_decimal_value(val2))
                except (ValueError, TypeError):
                    average_outputs[field_name] = val2

        # Формируем промежуточные результаты
        intermediate_results = {}

        for field_name, value in average_temps.items():
            if _is_nonempty_numeric(value):
                try:
                    int_value = int(parse_decimal_value(value))
                    normalized_key = field_name.replace("Температура н,к.", "Температура н.к.")
                    intermediate_results[normalized_key] = str(int_value)
                except (ValueError, TypeError):
                    normalized_key = field_name.replace("Температура н,к.", "Температура н.к.")
                    intermediate_results[normalized_key] = str(value)

        for field_name, value in average_outputs.items():
            if _is_nonempty_numeric(value):
                intermediate_results[f"Выход фракций до {field_name}"] = _format_one_decimal_str(value)

        result_json = orjson.dumps(intermediate_results, option=orjson.OPT_NON_STR_KEYS).decode("utf-8")

        return {
            "convergence": "satisfactory",
            "intermediate_results": intermediate_results,
            "result": result_json,
            "measurement_error": None,
            "unit": "%",
            "conditions_info": [],
            "is_fractional_composition": True,
        }

    except Exception as e:
        logger.error(f"Ошибка при расчете фракционного состава нефти: {e!s}")
        raise ValueError(f"Ошибка при расчете фракционного состава нефти: {e!s}")
