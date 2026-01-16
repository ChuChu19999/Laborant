from decimal import Decimal
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

        # Сначала вычисляем промежуточные результаты
        logger.info("Начало вычисления промежуточных результатов")
        intermediate_results = {}
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

        logger.info("Начало проверки условий повторяемости")
        satisfied_conditions = []

        for condition in research_method["convergence_conditions"]["formulas"]:
            try:
                logger.info(f"Проверка условия: {condition['formula']}")
                condition_result = evaluate_formula(
                    condition["formula"], variables, is_condition=True
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
                        condition["formula"], variables, is_condition=True
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
                        condition["formula"], variables, is_condition=True
                    )
                    conditions_info.append(
                        {
                            "formula": condition["formula"],
                            "satisfied": condition_result,
                            "convergence_value": condition["convergence_value"],
                            "calculation_steps": calculate_convergence_steps(
                                condition["formula"], variables
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

            response_data_early = {
                "convergence": convergence_result,
                "intermediate_results": intermediate_results,
                "result": result_text,
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
        measurement_error = None

        if convergence_result == "satisfactory":
            # Затем вычисляем основной результат
            try:
                logger.info(
                    f"Вычисление основного результата по формуле: {research_method['formula']}"
                )
                logger.info(f"Используемые переменные: {variables}")
                result = evaluate_formula(research_method["formula"], variables)
                logger.info(f"Неокругленный результат: {result}")
            except Exception as e:
                logger.error(f"Ошибка при вычислении основного результата: {str(e)}")
                raise ValueError(f"Ошибка при вычислении результата: {str(e)}")

            # Округляем результат
            logger.info(
                f"Округление результата: тип={research_method['rounding_type']}, знаков={research_method['rounding_decimal']}"
            )
            result = round_result(
                result,
                research_method["rounding_type"],
                research_method["rounding_decimal"],
            )
            logger.info(f"Окончательный результат после округления: {result}")

            # Вычисляем количество знаков после запятой в результате
            result_decimal_places = (
                len(str(result).split(".")[-1]) if "." in str(result) else 0
            )
            logger.info(
                f"Количество знаков после запятой в результате: {result_decimal_places}"
            )

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

        response_data = {
            "convergence": convergence_result,
            "intermediate_results": intermediate_results,
            "result": str(result) if result is not None else None,
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
