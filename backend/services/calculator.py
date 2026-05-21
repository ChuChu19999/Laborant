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

MF_OIL_DISPLAY_LABELS_KEY = "_mf_oil_display_labels"


def _variables_from_input_data(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Поля вроде _mf_oil_* не участвуют в формулах."""
    return {
        k: v
        for k, v in input_data.items()
        if k != "Цвет" and not (isinstance(k, str) and k.startswith("_mf_oil"))
    }


MASS_FRACTION_OIL_GROUP_NAME = "Массовая доля нефти"


def _has_mass_fraction_oil_group(research_method: Dict[str, Any]) -> bool:
    gn = str(research_method.get("group_name") or "").strip()
    if gn == MASS_FRACTION_OIL_GROUP_NAME:
        return True
    for group in research_method.get("groups") or []:
        if isinstance(group, dict):
            if str(group.get("name") or "").strip() == MASS_FRACTION_OIL_GROUP_NAME:
                return True
    return False


def _is_mass_fraction_oil_method(research_method: Dict[str, Any]) -> bool:
    """
    Логика массовой доли нефти: по группе «Массовая доля нефти» или по имени метода.
    Если группа другая — учитывается только имя метода.
    """
    if str(research_method.get("name") or "").strip() == MASS_FRACTION_OIL_GROUP_NAME:
        return True
    return _has_mass_fraction_oil_group(research_method)


def _mf_oil_c1_c2_both_zero(variables: Dict[str, Any]) -> bool:
    """Оба значения C₁ и C₂ считаются нулевыми (после округления в variables)."""

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


def _mf_oil_custom_is_menee_01(custom_value: Optional[str]) -> bool:
    """Подпись условия сходимости «менее 0,1» для mf_oil (без учёта регистра и пробелов по краям)."""
    if not custom_value:
        return False
    return str(custom_value).strip().casefold() == "менее 0,1".casefold()


def _mf_oil_skip_repeatability_div_by_sum(
    research_method: Dict[str, Any],
    variables: Dict[str, Any],
    condition: Dict[str, Any],
) -> bool:
    """
    Условия mf_oil с (C₁+C₂) в знаменателе при C₁=C₂=0 не вычисляем — деление на ноль.
    Для convergence_value «satisfactory» считаем условие выполненным (повторяемость пройдена).
    """
    if not _is_mass_fraction_oil_method(research_method):
        return False
    if not _mf_oil_c1_c2_both_zero(variables):
        return False
    formula = str(condition.get("formula") or "")
    if "(C₁+C₂)" not in formula and "(C1+C2)" not in formula:
        return False
    cv = condition.get("convergence_value")
    return cv in ("satisfactory", "unsatisfactory")


def _intermediate_field_by_name(
    research_method: Dict[str, Any],
) -> Dict[str, Dict[str, Any]]:
    fields = (research_method.get("intermediate_data") or {}).get("fields") or []
    return {str(f["name"]): f for f in fields if isinstance(f, dict) and f.get("name")}


def _field_uses_custom_rounding(field: Optional[Dict[str, Any]]) -> bool:
    """Своё округление промежуточного поля (не как итог)."""
    if not field:
        return False
    if field.get("use_multiple_rounding") or field.get("use_threshold_table"):
        return False
    return field.get("use_result_rounding") is False


def _quantize_decimal_places(value: Any, decimal_places: int) -> Decimal:
    d = Decimal(str(float(value)))
    return d.quantize(
        Decimal("0.1") ** int(decimal_places),
        rounding=ROUND_HALF_UP,
    )


def _resolve_intermediate_rounding(
    field: Optional[Dict[str, Any]],
    research_method: Dict[str, Any],
    result_decimal_places: Optional[int],
) -> Optional[tuple[str, int]]:
    """
    Правило округления для подстановки и отображения.
    ("decimal", N) или ("significant", N); None — не округлять здесь.
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
        return _quantize_decimal_places(value, param)
    if kind == "significant":
        return round_result(value, "significant", param)
    return value


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
            d = Decimal(str(value))
            step = Decimal(str(rounding_decimal))
            quotient = (d / step).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            return float(quotient * step)

        elif rounding_type == "decimal":
            if rounding_decimal is None:
                return value
            d = Decimal(str(value))
            return float(
                d.quantize(
                    Decimal("0.1") ** int(rounding_decimal), rounding=ROUND_HALF_UP
                )
            )

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

        # Обработка массовой доли нефти (группа «Массовая доля нефти» или имя метода)
        if _is_mass_fraction_oil_method(research_method):
            logger.info("Обработка метода массовой доли нефти")
            input_data.pop(MF_OIL_DISPLAY_LABELS_KEY, None)
            mf_oil_display_labels: Dict[str, str] = {}
            try:
                method_id = research_method.get("id")
                if not method_id:
                    raise ValueError("Не указан ID метода исследования")

                n1_value = input_data.get("n₁") or input_data.get("n1")
                n2_value = input_data.get("n₂") or input_data.get("n2")

                # Если есть n1, всегда пересчитываем C1
                if n1_value and (n1_value != "0" and str(n1_value).strip()):
                    c1_key = "C₁" if "C₁" in input_data else "C1"
                    c1_out = await calculate_mass_fraction_from_refraction(
                        db, n1_value, method_id
                    )
                    input_data[c1_key] = c1_out.stored_display
                    if c1_out.below_detection_limit:
                        mf_oil_display_labels[c1_key] = "менее 0,1"
                    logger.info(
                        f"Рассчитано C1: stored={c1_out.stored_display}, numeric={c1_out.numeric}, "
                        f"below_dl={c1_out.below_detection_limit} для n1={n1_value}"
                    )

                # Если есть n2, всегда пересчитываем C2
                if n2_value and (n2_value != "0" and str(n2_value).strip()):
                    c2_key = "C₂" if "C₂" in input_data else "C2"
                    c2_out = await calculate_mass_fraction_from_refraction(
                        db, n2_value, method_id
                    )
                    input_data[c2_key] = c2_out.stored_display
                    if c2_out.below_detection_limit:
                        mf_oil_display_labels[c2_key] = "менее 0,1"
                    logger.info(
                        f"Рассчитано C2: stored={c2_out.stored_display}, numeric={c2_out.numeric}, "
                        f"below_dl={c2_out.below_detection_limit} для n2={n2_value}"
                    )
                if mf_oil_display_labels:
                    input_data[MF_OIL_DISPLAY_LABELS_KEY] = mf_oil_display_labels
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
        variables = _variables_from_input_data(input_data)

        intermediate_fields_by_name = _intermediate_field_by_name(research_method)

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
                # Сохраняем неокругленное значение (для отображения value и справки)
                intermediate_results_unrounded[field["name"]] = intermediate_value
                # Добавляем результат в словарь только если show_calculation = true
                if field.get("show_calculation", True):
                    intermediate_results[field["name"]] = str(intermediate_value)
                # В переменные для последующих формул подставляем округленное значение (как на экране)
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

        # Округляем промежуточные для проверки повторяемости (как итог или по настройке поля)
        variables_rounded = _variables_from_input_data(input_data)
        logger.info("Округление промежуточных для проверки повторяемости")
        for field_name, unrounded_value in intermediate_results_unrounded.items():
            field_cfg = intermediate_fields_by_name.get(field_name)
            repeat_rounding = _resolve_intermediate_rounding(
                field_cfg, research_method, result_decimal_places
            )
            if repeat_rounding is not None and isinstance(
                unrounded_value, (int, float, Decimal)
            ):
                rounded_value = _apply_intermediate_rounding(
                    unrounded_value, repeat_rounding
                )
                variables_rounded[field_name] = rounded_value
                logger.info(
                    f"Промежуточный результат {field_name}: {unrounded_value} -> {rounded_value}"
                )
            else:
                variables_rounded[field_name] = unrounded_value

        logger.info("Начало проверки условий повторяемости с округленными значениями")
        satisfied_conditions = []

        for condition in research_method["convergence_conditions"]["formulas"]:
            try:
                if _mf_oil_skip_repeatability_div_by_sum(
                    research_method, variables_rounded, condition
                ):
                    if condition["convergence_value"] == "satisfactory":
                        satisfied_conditions.append("satisfactory")
                        logger.info(
                            "Массовая доля нефти: C₁=C₂=0 — удовлетворительная повторяемость "
                            "принята без вычисления формулы с (C₁+C₂) в знаменателе."
                        )
                    continue
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
                    if _mf_oil_skip_repeatability_div_by_sum(
                        research_method, variables_rounded, condition
                    ):
                        conditions_info.append(
                            {
                                "formula": condition["formula"],
                                "satisfied": True,
                                "convergence_value": condition["convergence_value"],
                                "calculation_steps": [],
                            }
                        )
                        continue
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

            early_result_places = None
            if research_method["rounding_type"] == "decimal":
                early_result_places = research_method["rounding_decimal"]
            intermediate_results_rounded = {}
            for field_name, unrounded_value in intermediate_results_unrounded.items():
                field_cfg = intermediate_fields_by_name.get(field_name)
                formatted = _format_intermediate_value_reference(
                    unrounded_value,
                    field_cfg,
                    research_method,
                    early_result_places,
                )
                intermediate_results_rounded[field_name] = formatted
                logger.info(
                    f"Промежуточный результат {field_name}: {formatted['value']} "
                    f"(справка: {formatted['reference']})"
                )

            if (
                _is_mass_fraction_oil_method(research_method)
                and convergence_result == "custom"
                and _mf_oil_custom_is_menee_01(custom_value)
            ):
                csr_entry = intermediate_results_rounded.get("Cср")
                if isinstance(csr_entry, dict) and csr_entry.get("value") is not None:
                    result_text = str(csr_entry["value"]).replace(".", ",")
                elif research_method.get("rounding_type") == "decimal":
                    places = research_method.get("rounding_decimal")
                    if places is not None:
                        zero_d = Decimal("0").quantize(
                            Decimal("0.1") ** int(places),
                            rounding=ROUND_HALF_UP,
                        )
                        result_text = str(zero_d).replace(".", ",")
                    else:
                        result_text = "0"
                else:
                    result_text = "0"

            response_data_early = {
                "convergence": convergence_result,
                "intermediate_results": intermediate_results_rounded,
                "result": result_text,
                "result_reference": None,
                "measurement_error": None,
                "unit": research_method["unit"],
                "conditions_info": conditions_info,
            }

            # Для массовой доли нефти возвращаем обновленные input_data с рассчитанными C1 и C2
            if _is_mass_fraction_oil_method(research_method):
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
                field_cfg = intermediate_fields_by_name.get(field_name)
                formatted = _format_intermediate_value_reference(
                    unrounded_value,
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
                    measurement_error = Decimal(str(measurement_error)).quantize(
                        Decimal("0.1") ** int(result_decimal_places),
                        rounding=ROUND_HALF_UP,
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
        if _is_mass_fraction_oil_method(research_method):
            response_data["updated_input_data"] = input_data

        logger.info(f"Подготовлен ответ: {response_data}")

        return response_data

    except Exception as e:
        logger.error(f"Необработанная ошибка при расчете: {str(e)}", exc_info=True)
        raise
