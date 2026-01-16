from typing import Any, Dict
import orjson
from core.logger import logger
from services.calculation import get_temperature_correction


def round_to_half(value):
    """Округляет по специальной логике для объемной доли отгона:
    - если дробная часть >= 0.25 и < 0.75, то округляем до 0.5
    - если дробная часть >= 0.75, то округляем до следующего целого числа
    - иначе округляем до ближайшего целого числа
    """
    try:
        val = float(str(value).replace(",", "."))
        integer_part = int(val)
        fractional_part = val - integer_part

        if fractional_part >= 0.75:
            return integer_part + 1
        elif fractional_part >= 0.25:
            return integer_part + 0.5
        else:
            return integer_part
    except (ValueError, TypeError):
        return value


def round_to_one_decimal(value):
    """Округляет до 1 знака после запятой"""
    try:
        val = float(str(value).replace(",", "."))
        return round(val, 1)
    except (ValueError, TypeError):
        return value


def calculate_fractional_composition(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Специальная функция для расчета фракционного состава конденсата.
    """
    try:
        logger.info("Начало расчета фракционного состава конденсата")

        # Обрабатываем данные по card_index
        if "_fractional_data" in input_data:
            fractional_data = input_data["_fractional_data"]
            card_1_data = fractional_data.get("card1", {})
            card_2_data = fractional_data.get("card2", {})
            logger.info(
                "Используем специальную структуру данных для фракционного состава"
            )
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

        # Обрабатываем первую параллель
        corrected_temps_1 = {}
        for field_name, temp_value in temp_fields_1:
            if temp_value and temp_value != "0" and temp_value.strip():
                try:
                    temp_float = float(str(temp_value).replace(",", "."))
                    correction = get_temperature_correction(temp_float, patm1)
                    corrected_temp = temp_float + correction
                    corrected_temps_1[field_name] = corrected_temp
                except (ValueError, TypeError):
                    corrected_temps_1[field_name] = temp_value
            else:
                corrected_temps_1[field_name] = temp_value

        # Обрабатываем вторую параллель
        corrected_temps_2 = {}
        for field_name, temp_value in temp_fields_2:
            if temp_value and temp_value != "0" and temp_value.strip():
                try:
                    temp_float = float(str(temp_value).replace(",", "."))
                    correction = get_temperature_correction(temp_float, patm2)
                    corrected_temp = temp_float + correction
                    corrected_temps_2[field_name] = corrected_temp
                except (ValueError, TypeError):
                    corrected_temps_2[field_name] = temp_value
            else:
                corrected_temps_2[field_name] = temp_value

        # Рассчитываем средние значения температур
        average_temps = {}
        for field_name in corrected_temps_1.keys():
            val1 = corrected_temps_1.get(field_name, 0)
            val2 = corrected_temps_2.get(field_name, 0)

            if (val1 and val1 != "0" and str(val1).strip()) and (
                val2 and val2 != "0" and str(val2).strip()
            ):
                try:
                    val1_float = float(str(val1).replace(",", "."))
                    val2_float = float(str(val2).replace(",", "."))
                    avg_val = (val1_float + val2_float) / 2
                    rounded_val = round(avg_val)
                    average_temps[field_name] = rounded_val
                except (ValueError, TypeError):
                    average_temps[field_name] = val1
            elif val1 and val1 != "0" and str(val1).strip():
                try:
                    val1_float = float(str(val1).replace(",", "."))
                    rounded_val = round(val1_float)
                    average_temps[field_name] = rounded_val
                except (ValueError, TypeError):
                    average_temps[field_name] = val1
            elif val2 and val2 != "0" and str(val2).strip():
                try:
                    val2_float = float(str(val2).replace(",", "."))
                    rounded_val = round(val2_float)
                    average_temps[field_name] = rounded_val
                except (ValueError, TypeError):
                    average_temps[field_name] = val2

        # Рассчитываем средние объемные доли
        average_volume_distillate = None
        average_volume_residue = None

        if (
            volume_distillate1
            and volume_distillate1 != "0"
            and str(volume_distillate1).strip()
        ):
            try:
                val1 = float(str(volume_distillate1).replace(",", "."))
                if (
                    volume_distillate2
                    and volume_distillate2 != "0"
                    and str(volume_distillate2).strip()
                ):
                    val2 = float(str(volume_distillate2).replace(",", "."))
                    average_volume_distillate = round_to_half((val1 + val2) / 2)
                else:
                    average_volume_distillate = round_to_half(val1)
            except (ValueError, TypeError):
                pass

        if volume_residue1 and volume_residue1 != "0" and str(volume_residue1).strip():
            try:
                val1 = float(str(volume_residue1).replace(",", "."))
                if (
                    volume_residue2
                    and volume_residue2 != "0"
                    and str(volume_residue2).strip()
                ):
                    val2 = float(str(volume_residue2).replace(",", "."))
                    average_volume_residue = round_to_one_decimal((val1 + val2) / 2)
                else:
                    average_volume_residue = round_to_one_decimal(val1)
            except (ValueError, TypeError):
                pass

        # Рассчитываем объемную долю потерь
        volume_losses = None
        if average_volume_distillate is not None and average_volume_residue is not None:
            try:
                distillate_val = float(str(average_volume_distillate).replace(",", "."))
                residue_val = float(str(average_volume_residue).replace(",", "."))
                volume_losses = 100 - distillate_val - residue_val
                volume_losses = round_to_one_decimal(volume_losses)
            except (ValueError, TypeError):
                pass

        # Формируем промежуточные результаты
        intermediate_results = {}

        for field_name, value in average_temps.items():
            if value and value != "0" and str(value).strip():
                if any(
                    temp_keyword in field_name.lower()
                    for temp_keyword in ["температура", "отгона при температуре"]
                ):
                    try:
                        value_str = str(value).replace(",", ".")
                        float_value = float(value_str)
                        int_value = int(float_value)
                        # Нормализуем ключ: заменяем запятую на точку
                        normalized_key = field_name.replace(
                            "Температура н,к.", "Температура н.к."
                        )
                        intermediate_results[normalized_key] = str(int_value)
                    except (ValueError, TypeError):
                        normalized_key = field_name.replace(
                            "Температура н,к.", "Температура н.к."
                        )
                        intermediate_results[normalized_key] = str(value)

        if average_volume_distillate is not None:
            intermediate_results["Объемная доля отгона"] = (
                f"{float(str(average_volume_distillate)):.1f}"
            )
        if average_volume_residue is not None:
            intermediate_results["Объемная доля остатка"] = (
                f"{float(str(average_volume_residue)):.1f}"
            )
        if volume_losses is not None:
            intermediate_results["Объемная доля потерь"] = (
                f"{float(str(volume_losses)):.1f}"
            )

        result_json = orjson.dumps(
            intermediate_results, option=orjson.OPT_NON_STR_KEYS
        ).decode("utf-8")

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
        logger.error(f"Ошибка при расчете фракционного состава: {str(e)}")
        raise ValueError(f"Ошибка при расчете фракционного состава: {str(e)}")


def calculate_fractional_composition_oil(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Специальная функция для расчета фракционного состава нефти.
    """
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

        # Рассчитываем средние значения температур
        average_temps = {}
        for field_name, val1 in temp_fields_1:
            val2 = temp_fields_2[temp_fields_1.index((field_name, val1))][1]

            if (val1 and val1 != "0" and str(val1).strip()) and (
                val2 and val2 != "0" and str(val2).strip()
            ):
                try:
                    val1_float = float(str(val1).replace(",", "."))
                    val2_float = float(str(val2).replace(",", "."))
                    avg_val = (val1_float + val2_float) / 2
                    rounded_val = round(avg_val)
                    average_temps[field_name] = rounded_val
                except (ValueError, TypeError):
                    average_temps[field_name] = val1
            elif val1 and val1 != "0" and str(val1).strip():
                try:
                    val1_float = float(str(val1).replace(",", "."))
                    rounded_val = round(val1_float)
                    average_temps[field_name] = rounded_val
                except (ValueError, TypeError):
                    average_temps[field_name] = val1
            elif val2 and val2 != "0" and str(val2).strip():
                try:
                    val2_float = float(str(val2).replace(",", "."))
                    rounded_val = round(val2_float)
                    average_temps[field_name] = rounded_val
                except (ValueError, TypeError):
                    average_temps[field_name] = val2

        # Рассчитываем средние значения выходов фракций
        average_outputs = {}
        for field_name, val1 in output_fields_1:
            val2 = output_fields_2[output_fields_1.index((field_name, val1))][1]

            if (val1 and val1 != "0" and str(val1).strip()) and (
                val2 and val2 != "0" and str(val2).strip()
            ):
                try:
                    avg_val = (
                        float(str(val1).replace(",", "."))
                        + float(str(val2).replace(",", "."))
                    ) / 2
                    average_outputs[field_name] = round(avg_val, 1)
                except (ValueError, TypeError):
                    average_outputs[field_name] = val1
            elif val1 and val1 != "0" and str(val1).strip():
                try:
                    average_outputs[field_name] = round(
                        float(str(val1).replace(",", ".")), 1
                    )
                except (ValueError, TypeError):
                    average_outputs[field_name] = val1
            elif val2 and val2 != "0" and str(val2).strip():
                try:
                    average_outputs[field_name] = round(
                        float(str(val2).replace(",", ".")), 1
                    )
                except (ValueError, TypeError):
                    average_outputs[field_name] = val2

        # Формируем промежуточные результаты
        intermediate_results = {}

        for field_name, value in average_temps.items():
            if value and value != "0" and str(value).strip():
                try:
                    value_str = str(value).replace(",", ".")
                    float_value = float(value_str)
                    int_value = int(float_value)
                    # Нормализуем ключ: заменяем запятую на точку
                    normalized_key = field_name.replace(
                        "Температура н,к.", "Температура н.к."
                    )
                    intermediate_results[normalized_key] = str(int_value)
                except (ValueError, TypeError):
                    normalized_key = field_name.replace(
                        "Температура н,к.", "Температура н.к."
                    )
                    intermediate_results[normalized_key] = str(value)

        for field_name, value in average_outputs.items():
            if value and value != "0" and str(value).strip():
                intermediate_results[f"Выход фракций до {field_name}"] = str(value)

        result_json = orjson.dumps(
            intermediate_results, option=orjson.OPT_NON_STR_KEYS
        ).decode("utf-8")

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
        logger.error(f"Ошибка при расчете фракционного состава нефти: {str(e)}")
        raise ValueError(f"Ошибка при расчете фракционного состава нефти: {str(e)}")
