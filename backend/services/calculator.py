from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from core.logger import logger
from services.chloride_salts import (
    apply_custom_early_result as apply_chloride_custom_early_result,
)
from services.chloride_salts import (
    enrich_early_response as enrich_chloride_early_response,
)
from services.chloride_salts import (
    is_chloride_salts_input_key,
    is_chloride_salts_method,
    prepare_chloride_salts_input,
)
from services.fractional import (
    calculate_fractional_composition,
    calculate_fractional_composition_oil,
)
from services.mass_fraction_oil import (
    is_mass_fraction_oil_input_key,
    is_mass_fraction_oil_method,
    log_skip_repeatability_div_by_sum,
    prepare_mass_fraction_oil_input,
)
from services.mass_fraction_oil import (
    resolve_custom_early_result_text as resolve_mf_oil_custom_early_result_text,
)
from services.mass_fraction_oil import (
    should_skip_repeatability_div_by_sum,
)
from utils.calculation_engine import (
    calculate_convergence_steps,
    evaluate_formula,
    parse_decimal_value,
    round_decimal_half_up,
    round_result,
)


def _variables_from_input_data(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Копия input_data только с полями, которые подставляются в формулы расчёта."""
    return {
        k: v
        for k, v in input_data.items()
        if k != "Цвет"
        and not is_mass_fraction_oil_input_key(k)
        and not is_chloride_salts_input_key(k)
    }


def _intermediate_fields(research_method: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Промежуточные поля метода; пустой intermediate_data трактуем как отсутствие полей."""
    raw = (research_method.get("intermediate_data") or {}).get("fields") or []
    return [field for field in raw if isinstance(field, dict)]


def _convergence_formulas(research_method: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Условия повторяемости; пустой convergence_conditions — без проверок."""
    raw = (research_method.get("convergence_conditions") or {}).get("formulas") or []
    return [condition for condition in raw if isinstance(condition, dict)]


def _intermediate_field_by_name(
    research_method: Dict[str, Any],
) -> Dict[str, Dict[str, Any]]:
    return {
        str(field["name"]): field
        for field in _intermediate_fields(research_method)
        if field.get("name")
    }


def _field_uses_custom_rounding(field: Optional[Dict[str, Any]]) -> bool:
    """Кастомное округление промежуточного поля (не как итог)."""
    if not field:
        return False
    if field.get("use_multiple_rounding") or field.get("use_threshold_table"):
        return False
    return field.get("use_result_rounding") is False


def _quantize_decimal_places(value: Any, decimal_places: int) -> Decimal:
    return round_decimal_half_up(value, decimal_places)


def _resolve_intermediate_rounding(
    field: Optional[Dict[str, Any]],
    research_method: Dict[str, Any],
    result_decimal_places: Optional[int],
) -> Optional[tuple[str, int]]:
    """
    Правило округления для подстановки и отображения.
    ("decimal", N) или ("significant", N); None — не округлять.
    """
    if _field_uses_custom_rounding(field):
        rounding_type = field.get("rounding_type") or "decimal"
        rounding_decimal = field.get("rounding_decimal")
        if rounding_decimal is None:
            rounding_decimal = research_method.get("rounding_decimal", 0)
        if rounding_type == "significant":
            return ("significant", int(rounding_decimal))
        return ("decimal", int(rounding_decimal))

    if result_decimal_places is not None:
        return ("decimal", int(result_decimal_places))

    if research_method.get("rounding_type") == "decimal":
        method_places = research_method.get("rounding_decimal")
        if method_places is not None:
            return ("decimal", int(method_places))
    elif research_method.get("rounding_type") == "significant":
        return (
            "significant",
            int(research_method.get("rounding_decimal", 3)),
        )
    return None


def _apply_intermediate_rounding(
    value: Any,
    rounding: Optional[tuple[str, int]],
) -> Any:
    if rounding is None or not isinstance(value, (int, float, Decimal)):
        return value
    kind, param = rounding
    if kind == "decimal":
        return round_decimal_half_up(value, param)
    if kind == "significant":
        return round_result(value, "significant", param)
    return value


def _evaluate_intermediate_field(
    field: Dict[str, Any],
    variables: Dict[str, Any],
    intermediate_fields_by_name: Dict[str, Dict[str, Any]],
) -> Any:
    """Вычисляет одно промежуточное поле по формуле и текущим переменным."""
    if field.get("use_threshold_table"):
        threshold_cfg = field["threshold_table_values"]
        target_field = intermediate_fields_by_name.get(threshold_cfg["target_variable"])
        formula = target_field["formula"] if target_field else field["formula"]
        return _round_value(
            value=0,
            rounding_type="threshold_table",
            threshold_table_values={
                "target_variable": threshold_cfg["target_variable"],
                "higher_variable": threshold_cfg["higher_variable"],
                "lower_variable": threshold_cfg["lower_variable"],
                "formula": formula,
            },
            variables=variables,
        )

    rounding_params = None
    if field.get("use_multiple_rounding"):
        rounding_params = {
            "use_multiple_rounding": True,
            "rounding_type": field.get("rounding_type"),
            "rounding_decimal": field.get("rounding_decimal"),
            "multiple_value": field.get("multiple_value"),
        }

    return evaluate_formula(
        field["formula"],
        variables,
        range_calculation=field.get("range_calculation"),
        rounding_params=rounding_params,
    )


def _build_variables_rounded_chain(
    input_data: Dict[str, Any],
    research_method: Dict[str, Any],
    intermediate_fields_by_name: Dict[str, Dict[str, Any]],
    result_decimal_places: Optional[int],
) -> Dict[str, Any]:
    """Пересчитывает промежуточные поля по цепочке с округлёнными предшественниками."""
    variables_rounded = _variables_from_input_data(input_data)
    logger.info("Пересчёт промежуточных с округлёнными значениями для цепочки формул")
    for field in _intermediate_fields(research_method):
        if not field.get("name", "").strip() or not field.get("formula", "").strip():
            continue
        field_name = field["name"]
        try:
            intermediate_value = _evaluate_intermediate_field(
                field, variables_rounded, intermediate_fields_by_name
            )
            repeat_rounding = _resolve_intermediate_rounding(
                field, research_method, result_decimal_places
            )
            if repeat_rounding is not None and isinstance(
                intermediate_value, (int, float, Decimal)
            ):
                rounded_value = _apply_intermediate_rounding(
                    intermediate_value, repeat_rounding
                )
                variables_rounded[field_name] = rounded_value
                logger.info(
                    f"Промежуточный результат {field_name}: "
                    f"{intermediate_value} -> {rounded_value}"
                )
            else:
                variables_rounded[field_name] = intermediate_value
        except Exception as e:
            logger.error(
                f"Ошибка при пересчёте промежуточного результата {field_name}: {str(e)}"
            )
            raise ValueError(
                f"Ошибка при пересчёте промежуточного результата: {str(e)}"
            )
    return variables_rounded


def _format_intermediate_display_entry(
    unrounded_value: Any,
    chain_value: Any,
    field: Optional[Dict[str, Any]],
    research_method: Dict[str, Any],
    result_decimal_places: Optional[int],
) -> Dict[str, str]:
    """value из цепочки округлённых значений, reference из неокруглённого расчёта."""
    reference_formatted = _format_intermediate_value_reference(
        unrounded_value, field, research_method, result_decimal_places
    )
    if isinstance(chain_value, (int, float, Decimal)):
        return {
            "value": str(chain_value),
            "reference": reference_formatted["reference"],
        }
    return reference_formatted


def _filter_intermediate_results_for_display(
    intermediate_results: Dict[str, Any],
    intermediate_fields_by_name: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    """Скрывает поля с show_calculation=False из ответа API."""
    return {
        name: value
        for name, value in intermediate_results.items()
        if intermediate_fields_by_name.get(name, {}).get("show_calculation", True)
    }


def _format_intermediate_value_reference(
    unrounded_value: Any,
    field: Optional[Dict[str, Any]],
    research_method: Dict[str, Any],
    result_decimal_places: Optional[int],
) -> Dict[str, str]:
    """value и reference (+1 знак для decimal, +1 значащая для significant)."""
    if not isinstance(unrounded_value, (int, float, Decimal)):
        text = str(unrounded_value)
        return {"value": text, "reference": text}

    rounding = _resolve_intermediate_rounding(
        field, research_method, result_decimal_places
    )
    if rounding is None:
        text = str(unrounded_value)
        return {"value": text, "reference": text}

    kind, param = rounding
    if kind == "significant":
        rounded_value = round_result(unrounded_value, "significant", param)
        reference_value = round_result(unrounded_value, "significant", param + 1)
        return {
            "value": str(rounded_value),
            "reference": str(reference_value),
        }

    rounded_value = _apply_intermediate_rounding(unrounded_value, rounding)
    reference_value = _quantize_decimal_places(unrounded_value, param + 1)
    return {
        "value": str(rounded_value),
        "reference": str(reference_value),
    }


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
            value = parse_decimal_value(value.replace(",", "."))
        else:
            value = parse_decimal_value(value)

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
                target_value = parse_decimal_value(variables.get(target_variable, "0"))
                formula_value = parse_decimal_value(variables.get(formula, "0"))
                higher_value = parse_decimal_value(variables.get(higher_variable, "0"))
                lower_value = parse_decimal_value(variables.get(lower_variable, "0"))

                logger.info(f"Значения для сравнения:")
                logger.info(f"{target_variable}: {target_value}")
                logger.info(f"{formula}: {formula_value}")
                logger.info(f"{higher_variable}: {higher_value}")
                logger.info(f"{lower_variable}: {lower_value}")

            except (ValueError, TypeError) as e:
                logger.error(f"Ошибка преобразования значений: {str(e)}")
                return value

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
            d = parse_decimal_value(value)
            step = parse_decimal_value(rounding_decimal)
            quotient = (d / step).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            return quotient * step

        elif rounding_type == "decimal":
            if rounding_decimal is None:
                return value
            return round_decimal_half_up(value, rounding_decimal)

        return value

    except (ValueError, TypeError) as e:
        logger.error(f"Ошибка в round_value: {str(e)}")
        return value


async def calculate_result(
    db: AsyncSession,
    input_data: Dict[str, Any],
    research_method: Dict[str, Any],
) -> Dict[str, Any]:
    """Вычисляет результат расчета."""
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

        if is_chloride_salts_method(research_method):
            prepare_chloride_salts_input(input_data)

        await prepare_mass_fraction_oil_input(db, input_data, research_method)

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
        # Исключаем поле "Цвет" из переменных для вычисления формул (это строка)
        variables = _variables_from_input_data(input_data)

        intermediate_fields_by_name = _intermediate_field_by_name(research_method)

        for field in _intermediate_fields(research_method):
            # Пропускаем поля с пустыми именами или формулами
            if (
                not field.get("name", "").strip()
                or not field.get("formula", "").strip()
            ):
                logger.info(f"Пропущено пустое промежуточное поле: {field}")
                continue

            try:
                logger.info(
                    f"Вычисление промежуточного результата: {field['name']}, формула: {field['formula']}"
                )

                intermediate_value = _evaluate_intermediate_field(
                    field, variables, intermediate_fields_by_name
                )

                logger.info(
                    f"Промежуточный результат {field['name']} = {intermediate_value}"
                )
                # Сохраняем неокругленное значение (для отображения value и справки)
                intermediate_results_unrounded[field["name"]] = intermediate_value
                # Добавляем результат в словарь только если show_calculation = true
                if field.get("show_calculation", True):
                    intermediate_results[field["name"]] = str(intermediate_value)
                # В переменные для последующих формул подставляем округленное значение
                chain_rounding = _resolve_intermediate_rounding(
                    field, research_method, None
                )
                if chain_rounding is not None and isinstance(
                    intermediate_value, (int, float, Decimal)
                ):
                    variables[field["name"]] = _apply_intermediate_rounding(
                        intermediate_value, chain_rounding
                    )
                else:
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

        # Пересчитываем цепочку с округлёнными предшественниками для проверки повторяемости
        variables_rounded = _build_variables_rounded_chain(
            input_data,
            research_method,
            intermediate_fields_by_name,
            result_decimal_places,
        )

        logger.info("Начало проверки условий повторяемости с округленными значениями")
        satisfied_conditions = []

        for condition in _convergence_formulas(research_method):
            formula = str(condition.get("formula") or "").strip()
            convergence_value = condition.get("convergence_value")
            if not formula or not convergence_value:
                continue
            try:
                if should_skip_repeatability_div_by_sum(
                    research_method, variables_rounded, condition
                ):
                    if convergence_value == "satisfactory":
                        satisfied_conditions.append("satisfactory")
                        log_skip_repeatability_div_by_sum()
                    continue
                logger.info(f"Проверка условия: {formula}")
                condition_result = evaluate_formula(
                    formula, variables_rounded, is_condition=True
                )
                logger.info(
                    f"Результат проверки условия: {condition_result} (тип: {convergence_value}"
                )

                if condition_result:
                    satisfied_conditions.append(convergence_value)
                    logger.info(
                        f"Условие {formula} выполнено, тип: {convergence_value}"
                    )
            except Exception as e:
                logger.error(f"Ошибка при проверке условия повторяемости: {str(e)}")
                raise ValueError(f"Ошибка при проверке условия повторяемости: {str(e)}")

        logger.info(f"Все выполненные условия: {satisfied_conditions}")

        # Проверяем условия в порядке приоритета
        convergence_result = "satisfactory"
        custom_value = None

        # Проверяем наличие кастомного значения
        for condition in _convergence_formulas(research_method):
            formula = str(condition.get("formula") or "").strip()
            if condition.get("convergence_value") == "custom" and condition.get(
                "custom_value"
            ):
                if not formula:
                    continue
                try:
                    condition_result = evaluate_formula(
                        formula, variables_rounded, is_condition=True
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
        for condition in _convergence_formulas(research_method):
            formula = str(condition.get("formula") or "").strip()
            convergence_value = condition.get("convergence_value")
            if convergence_value != convergence_result or not formula:
                continue
            try:
                if should_skip_repeatability_div_by_sum(
                    research_method, variables_rounded, condition
                ):
                    conditions_info.append(
                        {
                            "formula": formula,
                            "satisfied": True,
                            "convergence_value": convergence_value,
                            "calculation_steps": [],
                        }
                    )
                    continue
                condition_result = evaluate_formula(
                    formula, variables_rounded, is_condition=True
                )
                conditions_info.append(
                    {
                        "formula": formula,
                        "satisfied": condition_result,
                        "convergence_value": convergence_value,
                        "calculation_steps": calculate_convergence_steps(
                            formula, variables_rounded
                        ),
                    }
                )
            except Exception as e:
                logger.error(f"Ошибка при проверке условия повторяемости: {str(e)}")
                raise ValueError(f"Ошибка при проверке условия повторяемости: {str(e)}")

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

            early_result_places = None
            if research_method["rounding_type"] == "decimal":
                early_result_places = research_method["rounding_decimal"]
            variables_rounded_early = _build_variables_rounded_chain(
                input_data,
                research_method,
                intermediate_fields_by_name,
                early_result_places,
            )
            intermediate_results_rounded = {}
            for field_name, unrounded_value in intermediate_results_unrounded.items():
                field_cfg = intermediate_fields_by_name.get(field_name)
                formatted = _format_intermediate_display_entry(
                    unrounded_value,
                    variables_rounded_early.get(field_name, unrounded_value),
                    field_cfg,
                    research_method,
                    early_result_places,
                )
                intermediate_results_rounded[field_name] = formatted
                logger.info(
                    f"Промежуточный результат {field_name}: {formatted['value']} "
                    f"(справка: {formatted['reference']})"
                )

            chloride_result_text = apply_chloride_custom_early_result(
                research_method,
                convergence_result,
                custom_value,
                intermediate_results_rounded,
                input_data,
            )
            if chloride_result_text is not None:
                result_text = chloride_result_text

            mf_oil_result_text = resolve_mf_oil_custom_early_result_text(
                research_method,
                custom_value,
                intermediate_results_rounded,
            )
            if mf_oil_result_text is not None:
                result_text = mf_oil_result_text

            response_data_early = {
                "convergence": convergence_result,
                "intermediate_results": _filter_intermediate_results_for_display(
                    intermediate_results_rounded, intermediate_fields_by_name
                ),
                "result": result_text,
                "result_reference": None,
                "measurement_error": None,
                "unit": research_method["unit"],
                "conditions_info": conditions_info,
            }

            enrich_chloride_early_response(response_data_early, input_data)

            if is_mass_fraction_oil_method(research_method) or is_chloride_salts_method(
                research_method
            ):
                response_data_early["updated_input_data"] = input_data

            return response_data_early

        # Если все условия повторяемости выполнены, продолжаем расчет основного результата
        logger.info("Условия повторяемости удовлетворительны, продолжаем расчет")

        # Если повторяемость удовлетворительная, вычисляем результат
        result = None
        measurement_error = None

        if convergence_result == "satisfactory":
            # Формируем округленные промежуточные результаты для ответа
            intermediate_results_rounded = {}
            for field_name, unrounded_value in intermediate_results_unrounded.items():
                field_cfg = intermediate_fields_by_name.get(field_name)
                formatted = _format_intermediate_display_entry(
                    unrounded_value,
                    variables_rounded.get(field_name, unrounded_value),
                    field_cfg,
                    research_method,
                    result_decimal_places,
                )
                intermediate_results_rounded[field_name] = formatted
                logger.info(
                    f"Промежуточный результат {field_name}: {formatted['value']} "
                    f"(справка: {formatted['reference']})"
                )

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
                    result_decimal = parse_decimal_value(result_unrounded_rounded)
                    result_reference = round_decimal_half_up(
                        result_decimal, result_decimal_places + 1
                    )
                    logger.info(f"Справочное значение результата: {result_reference}")
                else:
                    result_reference = None
            except Exception as e:
                logger.error(f"Ошибка при вычислении основного результата: {str(e)}")
                raise ValueError(f"Ошибка при вычислении результата: {str(e)}")

            # Обновляем промежуточные результаты в ответе
            intermediate_results = _filter_intermediate_results_for_display(
                intermediate_results_rounded, intermediate_fields_by_name
            )

            # Вычисляем погрешность
            try:
                error_config = research_method.get("measurement_error") or {}
                error_type = error_config.get("type")
                logger.info(f"Вычисление погрешности: {error_config}")

                if not error_type:
                    measurement_error = None
                    logger.info("Погрешность не задана, пропускаем вычисление")
                elif error_type == "fixed":
                    measurement_error = parse_decimal_value(error_config["value"])
                elif error_type == "formula":
                    variables["result"] = result
                    measurement_error = evaluate_formula(
                        error_config["value"], variables
                    )
                else:
                    logger.warning("Неподдерживаемый тип погрешности")
                    measurement_error = Decimal("0")

                # Округляем погрешность до того же количества знаков после запятой, что и результат
                if measurement_error is not None:
                    measurement_error = round_decimal_half_up(
                        measurement_error, result_decimal_places
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

        # Для массовой доли нефти возвращаем обновленные input_data с рассчитанными C1 и C2
        if is_mass_fraction_oil_method(research_method):
            response_data["updated_input_data"] = input_data

        logger.info(f"Подготовлен ответ: {response_data}")

        return response_data

    except Exception as e:
        logger.error(f"Необработанная ошибка при расчете: {str(e)}", exc_info=True)
        raise
