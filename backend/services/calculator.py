from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from core.logger import logger
from services.calculation import (
    calculate_convergence_steps,
    calculate_mass_fraction_from_refraction,
    evaluate_formula,
    get_temperature_correction,
    round_result,
)
from services.fractional import (
    calculate_fractional_composition,
    calculate_fractional_composition_oil,
)


def _round_value(
    value,
    rounding_type=None,
    rounding_decimal=None,
    threshold_table_values=None,
    variables=None,
):
    """Округляет значение по заданным параметрам."""
    try:
        if value is None:
            return value

        if isinstance(value, str):
            value = float(value.replace(",", "."))
        else:
            value = float(value)

        if rounding_type == "threshold_table":
            if (
                not threshold_table_values
                or not isinstance(threshold_table_values, dict)
                or not variables
            ):
                logger.error(
                    "Отсутствуют необходимые параметры для табличного округления"
                )
                return value

            target_variable = threshold_table_values.get("target_variable")
            higher_variable = threshold_table_values.get("higher_variable")
            lower_variable = threshold_table_values.get("lower_variable")
            formula = threshold_table_values.get("formula")

            if not all([target_variable, higher_variable, lower_variable, formula]):
                logger.error("Не все необходимые переменные определены")
                return value

            try:
                target_value = float(
                    str(variables.get(target_variable, "0")).replace(",", ".")
                )
                formula_value = float(
                    str(variables.get(formula, "0")).replace(",", ".")
                )
                higher_value = float(
                    str(variables.get(higher_variable, "0")).replace(",", ".")
                )
                lower_value = float(
                    str(variables.get(lower_variable, "0")).replace(",", ".")
                )

                logger.info(f"Значения для сравнения:")
                logger.info(f"{target_variable}: {target_value}")
                logger.info(f"{formula}: {formula_value}")
                logger.info(f"{higher_variable}: {higher_value}")
                logger.info(f"{lower_variable}: {lower_value}")

            except (ValueError, TypeError) as e:
                logger.error(f"Ошибка преобразования значений: {str(e)}")
                return value

            # Сравнение и выбор значения
            if formula_value < target_value:
                logger.info(
                    f"formula_value ({formula_value}) < target_value ({target_value})"
                )
                logger.info(f"Выбрано верхнее значение: {higher_value}")
                return higher_value
            else:
                logger.info(
                    f"formula_value ({formula_value}) >= target_value ({target_value})"
                )
                logger.info(f"Выбрано нижнее значение: {lower_value}")
                return lower_value

        elif rounding_type == "multiple":
            if not rounding_decimal:
                return value
            return round(value / rounding_decimal) * rounding_decimal

        elif rounding_type == "decimal":
            if rounding_decimal is None:
                return value
            return round(value, rounding_decimal)

        return value

    except (ValueError, TypeError) as e:
        logger.error(f"Ошибка в round_value: {str(e)}")
        return value


async def calculate_result(
    db: AsyncSession,
    input_data: Dict[str, Any],
    research_method: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Вычисляет результат расчета.
    """
    try:
        logger.info("Начало расчета")

        if not input_data or not research_method:
            raise ValueError(
                "Необходимо предоставить входные данные и метод исследования"
            )

        # Заменяем пустые значения на '0'
        processed_input_data = {}
        for key, value in input_data.items():
            # Пропускаем _fractional_data для фракционного состава
            if key == "_fractional_data":
                processed_input_data[key] = value
                continue

            if value is None or (isinstance(value, str) and value.strip() == ""):
                processed_input_data[key] = "0"
                logger.info(f"Пустое значение в поле {key} заменено на '0'")
            else:
                processed_input_data[key] = value

        input_data = processed_input_data

        # Обработка для метода "Массовая доля нефти"
        if research_method.get("name") == "Массовая доля нефти":
            logger.info("Обработка метода: Массовая доля нефти")
            try:
                method_id = research_method.get("id")
                if not method_id:
                    raise ValueError("Не указан ID метода исследования")

                n1_value = input_data.get("n₁") or input_data.get("n1")
                n2_value = input_data.get("n₂") or input_data.get("n2")

                # Если есть n1, всегда пересчитываем C1
                if n1_value and (n1_value != "0" and str(n1_value).strip()):
                    c1_key = "C₁" if "C₁" in input_data else "C1"
                    c1_result = await calculate_mass_fraction_from_refraction(
                        db, n1_value, method_id
                    )
                    input_data[c1_key] = str(c1_result).replace(".", ",")
                    logger.info(f"Рассчитано C1={c1_result} для n1={n1_value}")

                # Если есть n2, всегда пересчитываем C2
                if n2_value and (n2_value != "0" and str(n2_value).strip()):
                    c2_key = "C₂" if "C₂" in input_data else "C2"
                    c2_result = await calculate_mass_fraction_from_refraction(
                        db, n2_value, method_id
                    )
                    input_data[c2_key] = str(c2_result).replace(".", ",")
                    logger.info(f"Рассчитано C2={c2_result} для n2={n2_value}")
            except Exception as e:
                logger.error(
                    f"Ошибка при расчете C1/C2 для массовой доли нефти: {str(e)}"
                )
                raise ValueError(f"Ошибка при расчете массовой доли нефти: {str(e)}")

        # Обработка для фракционного состава конденсата
        if research_method.get("name") == "Фракционный состав (конденсат)":
            logger.info("Обработка метода: Фракционный состав (конденсат)")
            result = calculate_fractional_composition(input_data)
            return result

        # Обработка для фракционного состава нефти
        if research_method.get("name") == "Фракционный состав (нефть)":
            logger.info("Обработка метода: Фракционный состав (нефть)")
            result = calculate_fractional_composition_oil(input_data)
            return result

        # Проверяем тип округления
        if research_method["rounding_type"] not in ["decimal", "significant"]:
            raise ValueError(
                f"Неверный тип округления: {research_method['rounding_type']}"
            )

        # Сначала вычисляем промежуточные результаты (неокругленные)
        logger.info("Начало вычисления промежуточных результатов")
        intermediate_results = {}
        intermediate_results_unrounded = {}  # Сохраняем неокругленные значения
        # Исключаем поле "Цвет" из переменных для вычисления формул (это строка, не число)
        variables = {k: v for k, v in input_data.items() if k != "Цвет"}

        for field in research_method["intermediate_data"]["fields"]:
            # Пропускаем поля с пустыми именами или формулами
            if not field["name"].strip() or not field["formula"].strip():
                logger.info(f"Пропущено пустое промежуточное поле: {field}")
                continue

            try:
                logger.info(
                    f"Вычисление промежуточного результата: {field['name']}, формула: {field['formula']}"
                )

                # Если используется метод ближайших табличных значений
                if field.get("use_threshold_table"):
                    target_field = next(
                        (
                            f
                            for f in research_method["intermediate_data"]["fields"]
                            if f["name"]
                            == field["threshold_table_values"]["target_variable"]
                        ),
                        None,
                    )

                    if target_field:
                        formula = target_field["formula"]
                    else:
                        formula = field["formula"]

                    intermediate_value = _round_value(
                        value=0,
                        rounding_type="threshold_table",
                        threshold_table_values={
                            "target_variable": field["threshold_table_values"][
                                "target_variable"
                            ],
                            "higher_variable": field["threshold_table_values"][
                                "higher_variable"
                            ],
                            "lower_variable": field["threshold_table_values"][
                                "lower_variable"
                            ],
                            "formula": formula,
                        },
                        variables=variables,
                    )
                else:
                    # Подготавливаем параметры округления
                    rounding_params = None
                    if field.get("use_multiple_rounding"):
                        rounding_params = {
                            "use_multiple_rounding": True,
                            "rounding_type": field.get("rounding_type"),
                            "rounding_decimal": field.get("rounding_decimal"),
                            "multiple_value": field.get("multiple_value"),
                        }

                    # Проверяем наличие диапазонного расчета
                    range_calculation = field.get("range_calculation")

                    intermediate_value = evaluate_formula(
                        field["formula"],
                        variables,
                        range_calculation=range_calculation,
                        rounding_params=rounding_params,
                    )

                logger.info(
                    f"Промежуточный результат {field['name']} = {intermediate_value}"
                )
                # Сохраняем неокругленное значение
                intermediate_results_unrounded[field["name"]] = intermediate_value
                # Добавляем результат в словарь только если show_calculation = true
                if field.get("show_calculation", True):
                    intermediate_results[field["name"]] = str(intermediate_value)
                # В любом случае добавляем значение в переменные для дальнейших расчетов
                variables[field["name"]] = intermediate_value
            except Exception as e:
                logger.error(
                    f"Ошибка при вычислении промежуточного результата {field['name']}: {str(e)}"
                )
                raise ValueError(
                    f"Ошибка при вычислении промежуточного результата: {str(e)}"
                )

        # Сначала вычисляем неокругленный основной результат для определения количества знаков
        result_unrounded_for_rounding = None
        result_decimal_places = None
        if research_method["rounding_type"] == "decimal":
            try:
                logger.info(
                    f"Предварительное вычисление результата для определения количества знаков: {research_method['formula']}"
                )
                result_unrounded_for_rounding = evaluate_formula(
                    research_method["formula"], variables
                )
                # Округляем для определения количества знаков
                result_temp = round_result(
                    result_unrounded_for_rounding,
                    research_method["rounding_type"],
                    research_method["rounding_decimal"],
                )
                result_decimal_places = (
                    len(str(result_temp).split(".")[-1])
                    if "." in str(result_temp)
                    else 0
                )
                logger.info(
                    f"Количество знаков после запятой в результате: {result_decimal_places}"
                )
            except Exception as e:
                logger.warning(
                    f"Не удалось определить количество знаков: {str(e)}, используем настройки метода"
                )
                result_decimal_places = research_method["rounding_decimal"]
        elif research_method["rounding_type"] == "significant":
            try:
                logger.info(
                    f"Предварительное вычисление результата (significant): {research_method['formula']}"
                )
                result_unrounded_for_rounding = evaluate_formula(
                    research_method["formula"], variables
                )
                result_temp = round_result(
                    result_unrounded_for_rounding,
                    research_method["rounding_type"],
                    research_method["rounding_decimal"],
                )
                result_decimal_places = (
                    len(str(result_temp).split(".")[-1])
                    if "." in str(result_temp)
                    else 0
                )
                logger.info(
                    f"Количество знаков после запятой в результате (significant): {result_decimal_places}"
                )
            except Exception as e:
                logger.warning(
                    f"Не удалось определить количество знаков (significant): {str(e)}"
                )
                result_decimal_places = research_method.get("rounding_decimal", 3)

        # Округляем промежуточные результаты до количества знаков результата
        variables_rounded = {k: v for k, v in input_data.items() if k != "Цвет"}
        if result_decimal_places is not None:
            logger.info(
                f"Округление промежуточных результатов до {result_decimal_places} знаков"
            )
            for field_name, unrounded_value in intermediate_results_unrounded.items():
                if isinstance(unrounded_value, (int, float, Decimal)):
                    d = Decimal(str(float(unrounded_value)))
                    rounded_value = d.quantize(
                        Decimal("0.1") ** result_decimal_places, rounding=ROUND_HALF_UP
                    )
                    variables_rounded[field_name] = rounded_value
                    logger.info(
                        f"Промежуточный результат {field_name}: {unrounded_value} -> {rounded_value}"
                    )
                else:
                    variables_rounded[field_name] = unrounded_value
        else:
            # Если не удалось определить количество знаков, используем неокругленные значения
            variables_rounded = variables

        logger.info("Начало проверки условий повторяемости с округленными значениями")
        satisfied_conditions = []

        for condition in research_method["convergence_conditions"]["formulas"]:
            try:
                logger.info(f"Проверка условия: {condition['formula']}")
                condition_result = evaluate_formula(
                    condition["formula"], variables_rounded, is_condition=True
                )
                logger.info(
                    f"Результат проверки условия: {condition_result} (тип: {condition['convergence_value']}"
                )

                if condition_result:
                    satisfied_conditions.append(condition["convergence_value"])
                    logger.info(
                        f"Условие {condition['formula']} выполнено, тип: {condition['convergence_value']}"
                    )
            except Exception as e:
                logger.error(f"Ошибка при проверке условия повторяемости: {str(e)}")
                raise ValueError(f"Ошибка при проверке условия повторяемости: {str(e)}")

        logger.info(f"Все выполненные условия: {satisfied_conditions}")

        # Проверяем условия в порядке приоритета
        convergence_result = "satisfactory"
        custom_value = None

        # Проверяем наличие кастомного значения
        for condition in research_method["convergence_conditions"]["formulas"]:
            if condition["convergence_value"] == "custom" and condition.get(
                "custom_value"
            ):
                try:
                    condition_result = evaluate_formula(
                        condition["formula"], variables_rounded, is_condition=True
                    )
                    if condition_result:
                        convergence_result = "custom"
                        custom_value = condition["custom_value"]
                        break
                except Exception as e:
                    logger.error(f"Ошибка при проверке кастомного условия: {str(e)}")
                    continue

        # Если кастомное условие не сработало, проверяем остальные условия
        if convergence_result != "custom":
            if "absence" in satisfied_conditions:
                convergence_result = "absence"
            elif "traces" in satisfied_conditions:
                convergence_result = "traces"
            elif "unsatisfactory" in satisfied_conditions:
                convergence_result = "unsatisfactory"

        # Сохраняем информацию только о выбранном условии
        conditions_info = []
        for condition in research_method["convergence_conditions"]["formulas"]:
            if condition["convergence_value"] == convergence_result:
                try:
                    condition_result = evaluate_formula(
                        condition["formula"], variables_rounded, is_condition=True
                    )
                    conditions_info.append(
                        {
                            "formula": condition["formula"],
                            "satisfied": condition_result,
                            "convergence_value": condition["convergence_value"],
                            "calculation_steps": calculate_convergence_steps(
                                condition["formula"], variables_rounded
                            ),
                        }
                    )
                except Exception as e:
                    logger.error(f"Ошибка при проверке условия повторяемости: {str(e)}")
                    raise ValueError(
                        f"Ошибка при проверке условия повторяемости: {str(e)}"
                    )

        # Если повторяемость отсутствие, неудовлетворительная, следы или задано кастомное значение, возвращаем результат без расчета
        if convergence_result in ["absence", "traces", "unsatisfactory", "custom"]:
            logger.info(
                f"Повторяемость отсутствие, неудовлетворительная, следы: {convergence_result}"
            )

            # Определяем текст результата в зависимости от типа повторяемости
            result_text = None
            if convergence_result == "custom":
                result_text = custom_value.lower() if custom_value else None
            elif convergence_result == "absence":
                result_text = "отсутствие"
            elif convergence_result == "traces":
                result_text = "следы"
            elif convergence_result == "unsatisfactory":
                result_text = "неудовлетворительно"

            # Округляем промежуточные результаты до количества знаков из настроек метода
            # (используем rounding_decimal из метода исследования)
            intermediate_results_rounded = {}
            if research_method["rounding_type"] == "decimal":
                result_decimal_places = research_method["rounding_decimal"]
                logger.info(
                    f"Округление промежуточных результатов до {result_decimal_places} знаков (из настроек метода)"
                )

                for (
                    field_name,
                    unrounded_value,
                ) in intermediate_results_unrounded.items():
                    if isinstance(unrounded_value, (int, float, Decimal)):
                        d = Decimal(str(float(unrounded_value)))
                        # Основное округление (до N знаков)
                        rounded_value = d.quantize(
                            Decimal("0.1") ** result_decimal_places,
                            rounding=ROUND_HALF_UP,
                        )
                        # Справочное округление (до N+1 знаков)
                        reference_value = d.quantize(
                            Decimal("0.1") ** (result_decimal_places + 1),
                            rounding=ROUND_HALF_UP,
                        )
                        intermediate_results_rounded[field_name] = {
                            "value": str(rounded_value),
                            "reference": str(reference_value),
                        }
                        logger.info(
                            f"Промежуточный результат {field_name}: {rounded_value} (справка (с точностью +1 знак): {reference_value})"
                        )
                    else:
                        intermediate_results_rounded[field_name] = {
                            "value": str(unrounded_value),
                            "reference": str(unrounded_value),
                        }
            else:
                # Для significant округления используем старый формат
                for field_name, value_str in intermediate_results.items():
                    intermediate_results_rounded[field_name] = {
                        "value": value_str,
                        "reference": value_str,
                    }

            response_data_early = {
                "convergence": convergence_result,
                "intermediate_results": intermediate_results_rounded,
                "result": result_text,
                "result_reference": None,
                "measurement_error": None,
                "unit": research_method["unit"],
                "conditions_info": conditions_info,
            }

            # Для метода "Массовая доля нефти" возвращаем обновленные input_data с рассчитанными C1 и C2
            if research_method.get("name") == "Массовая доля нефти":
                response_data_early["updated_input_data"] = input_data

            return response_data_early

        # Если все условия повторяемости выполнены, продолжаем расчет основного результата
        logger.info("Условия повторяемости удовлетворительны, продолжаем расчет")

        # Если повторяемость удовлетворительная, вычисляем результат
        result = None
        result_unrounded = None
        measurement_error = None

        if convergence_result == "satisfactory":
            # Формируем округленные промежуточные результаты для ответа
            intermediate_results_rounded = {}
            for field_name, unrounded_value in intermediate_results_unrounded.items():
                if (
                    isinstance(unrounded_value, (int, float, Decimal))
                    and result_decimal_places is not None
                ):
                    d = Decimal(str(float(unrounded_value)))
                    # Основное округление (до N знаков)
                    rounded_value = d.quantize(
                        Decimal("0.1") ** result_decimal_places, rounding=ROUND_HALF_UP
                    )
                    # Справочное округление (до N+1 знаков)
                    reference_value = d.quantize(
                        Decimal("0.1") ** (result_decimal_places + 1),
                        rounding=ROUND_HALF_UP,
                    )
                    intermediate_results_rounded[field_name] = {
                        "value": str(rounded_value),
                        "reference": str(reference_value),
                    }
                    logger.info(
                        f"Промежуточный результат {field_name}: {rounded_value} (справка: {reference_value})"
                    )
                else:
                    intermediate_results_rounded[field_name] = {
                        "value": str(unrounded_value),
                        "reference": str(unrounded_value),
                    }

            # Вычисляем основной результат с округленными промежуточными значениями
            try:
                logger.info(
                    "Вычисление основного результата с округленными промежуточными значениями"
                )
                result_unrounded_rounded = evaluate_formula(
                    research_method["formula"], variables_rounded
                )
                logger.info(
                    f"Неокругленный результат с округленными промежуточными: {result_unrounded_rounded}"
                )

                # Округляем пересчитанный результат
                result = round_result(
                    result_unrounded_rounded,
                    research_method["rounding_type"],
                    research_method["rounding_decimal"],
                )
                logger.info(f"Окончательный результат после пересчета: {result}")

                # Справочное значение результата с +1 знаком
                if result_decimal_places is not None:
                    result_decimal = Decimal(str(float(result_unrounded_rounded)))
                    result_reference = result_decimal.quantize(
                        Decimal("0.1") ** (result_decimal_places + 1),
                        rounding=ROUND_HALF_UP,
                    )
                    logger.info(f"Справочное значение результата: {result_reference}")
                else:
                    result_reference = None
            except Exception as e:
                logger.error(f"Ошибка при вычислении основного результата: {str(e)}")
                raise ValueError(f"Ошибка при вычислении результата: {str(e)}")

            # Обновляем промежуточные результаты в ответе
            intermediate_results = intermediate_results_rounded

            # Вычисляем погрешность
            try:
                error_config = research_method["measurement_error"]
                logger.info(f"Вычисление погрешности: {error_config}")

                if error_config["type"] == "fixed":
                    measurement_error = float(error_config["value"])
                elif error_config["type"] == "formula":
                    variables["result"] = result
                    measurement_error = float(
                        evaluate_formula(error_config["value"], variables)
                    )
                else:
                    logger.warning("Неподдерживаемый тип погрешности")
                    measurement_error = 0

                # Округляем погрешность до того же количества знаков после запятой, что и результат
                if measurement_error is not None:
                    measurement_error = round(
                        Decimal(str(measurement_error)), result_decimal_places
                    )
                    logger.info(f"Погрешность после округления: {measurement_error}")

            except Exception as e:
                logger.error(f"Ошибка при вычислении погрешности: {str(e)}")
                raise ValueError(f"Ошибка при вычислении погрешности: {str(e)}")

        # Формируем структуру ответа с основными и справочными значениями
        result_reference_value = None
        if convergence_result == "satisfactory" and result is not None:
            result_reference_value = str(result_reference)

        response_data = {
            "convergence": convergence_result,
            "intermediate_results": intermediate_results,
            "result": str(result) if result is not None else None,
            "result_reference": result_reference_value,
            "measurement_error": (
                str(measurement_error) if measurement_error is not None else None
            ),
            "unit": research_method["unit"],
            "conditions_info": conditions_info,
        }

        # Для метода "Массовая доля нефти" возвращаем обновленные input_data с рассчитанными C1 и C2
        if research_method.get("name") == "Массовая доля нефти":
            response_data["updated_input_data"] = input_data

        logger.info(f"Подготовлен ответ: {response_data}")

        return response_data

    except Exception as e:
        logger.error(f"Необработанная ошибка при расчете: {str(e)}", exc_info=True)
        raise
