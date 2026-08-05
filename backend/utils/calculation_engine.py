from __future__ import annotations
import re
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from core.logger import logger


def parse_decimal_value(value: Any) -> Decimal:
    """Число в Decimal: строки и целые точно, float без лишнего хвоста."""
    if isinstance(value, Decimal):
        return value
    if isinstance(value, bool):
        raise ValueError(f"недопустимое числовое значение: {value!r}")
    if isinstance(value, int):
        return Decimal(value)
    if isinstance(value, float):
        text = format(value, ".15g")
        if "e" in text or "E" in text:
            text = format(value, ".15f").rstrip("0").rstrip(".")
        return Decimal(text if text else "0")
    if isinstance(value, str):
        text = value.strip().replace(",", ".")
        if not text:
            raise ValueError("пустое числовое значение")
        return Decimal(text)
    raise ValueError(f"не удалось преобразовать в число: {value!r}")


def round_decimal_half_up(value: Any, decimal_places: int) -> Decimal:
    """Округление до N знаков после запятой, 0.5 вверх, как при ручном счёте."""
    places = int(decimal_places)
    quant = Decimal("1") if places == 0 else Decimal("0.1") ** places
    return parse_decimal_value(value).quantize(quant, rounding=ROUND_HALF_UP)


def _formula_variable_value(value: Any) -> Decimal:
    """Значение переменной формулы: ввод пользователя или округлённый промежуточный шаг."""
    return parse_decimal_value(value)


def _eval_numeric_result(result: Any) -> Decimal:
    if isinstance(result, Decimal):
        return result
    if isinstance(result, (int, float)):
        return parse_decimal_value(result)
    raise ValueError(f"формула вернула не число: {result!r}")


def _round_half_up(value, ndigits=0):
    """Округляет число по правилу 0.5 вверх (для round() внутри формул)."""
    return round_decimal_half_up(value, ndigits)


def round_significant_half_up(value: Any, significant_figures: int) -> Decimal:
    """Округление до N значащих цифр, 0.5 вверх."""
    sf = int(significant_figures)
    if sf <= 0:
        raise ValueError(
            f"число значащих цифр должно быть положительным: {significant_figures}"
        )
    d = parse_decimal_value(value)
    if d.is_zero():
        return Decimal("0")
    quant_exp = d.adjusted() - sf + 1
    quant = Decimal("1").scaleb(quant_exp)
    return d.quantize(quant, rounding=ROUND_HALF_UP)


def _round_to_multiple(number, multiple):
    """Округляет число до ближайшего кратного заданному числу."""
    try:
        d = parse_decimal_value(number)
        m = parse_decimal_value(multiple)
        quotient = (d / m).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        return quotient * m
    except Exception as e:
        raise ValueError(f"Ошибка при округлении до кратного: {str(e)}")


def round_result(result, rounding_type, rounding_decimal):
    """Округляет результат по заданному типу и количеству знаков."""
    if rounding_type == "decimal":
        return round_decimal_half_up(result, rounding_decimal)
    return round_significant_half_up(result, rounding_decimal)


def _replace_subscript_digits(text):
    """Заменяет подстрочные символы на обычные."""
    subscript_map = {
        "₀": "0",
        "₁": "1",
        "₂": "2",
        "₃": "3",
        "₄": "4",
        "₅": "5",
        "₆": "6",
        "₇": "7",
        "₈": "8",
        "₉": "9",
        "ₐ": "a",
        "ₑ": "e",
        "ₕ": "h",
        "ᵢ": "i",
        "ⱼ": "j",
        "ₖ": "k",
        "ₗ": "l",
        "ₘ": "m",
        "ₙ": "n",
        "ₒ": "o",
        "ₚ": "p",
        "ᵣ": "r",
        "ₛ": "s",
        "ₜ": "t",
        "ᵤ": "u",
        "ᵥ": "v",
        "ₓ": "x",
        "ᵦ": "β",
        "ᵧ": "γ",
        "ᵨ": "ρ",
        "ᵩ": "φ",
        "ᵪ": "χ",
    }

    result = text
    for subscript, normal in subscript_map.items():
        result = result.replace(subscript, normal)
    return result


_FORMULA_NUMBER_RE = re.compile(
    r"(?<![\w.])(-?\d+\.\d+|-?\d+\.|-?\.\d+|-?\d+)(?![\w.])"
)


def _normalize_formula_text(formula: str) -> str:
    text = _replace_subscript_digits(formula)
    return text.replace("×", "*").replace("÷", "/")


def _decimalize_formula_literals(formula: str) -> str:
    """Числовые литералы в формуле становятся Decimal, чтобы не смешивать float и Decimal."""

    def repl(match: re.Match[str]) -> str:
        return f"Decimal('{match.group(1)}')"

    return _FORMULA_NUMBER_RE.sub(repl, formula)


def _formula_safe_dict(decimal_vars: dict[str, Decimal]) -> dict[str, Any]:
    return {
        "__builtins__": {},
        "Decimal": Decimal,
        "abs": abs,
        "pow": pow,
        "round": _round_half_up,
        "max": max,
        "min": min,
        **decimal_vars,
    }


def _eval_prepared_formula(
    prepared_formula: str, decimal_vars: dict[str, Decimal]
) -> Decimal:
    safe_dict = _formula_safe_dict(decimal_vars)
    return _eval_numeric_result(
        eval(prepared_formula, {"__builtins__": None}, safe_dict)
    )


def evaluate_formula(
    formula, variables, is_condition=False, range_calculation=None, rounding_params=None
):
    """Вычисляет результат формулы."""
    try:
        formula = _normalize_formula_text(formula)

        # Если есть диапазонный расчет, сразу его применяем
        if not is_condition and range_calculation and "ranges" in range_calculation:
            # Создаем словарь переменных для диапазонного расчета
            decimal_vars = {}
            for name, value in variables.items():
                try:
                    new_name = _replace_subscript_digits(name)
                    decimal_vars[new_name] = _formula_variable_value(value)
                except Exception as e:
                    raise ValueError(
                        f"Ошибка преобразования значения {name} = {value} в число: {str(e)}"
                    )

            safe_dict = _formula_safe_dict(decimal_vars)

            # Проверяем каждый диапазон
            for range_item in range_calculation["ranges"]:
                # Сначала разбиваем условие на части по or
                or_conditions = range_item["condition"].split(" or ")
                any_or_condition_met = False

                for or_condition in or_conditions:
                    # Разбиваем каждое or-условие на and-условия
                    and_conditions = or_condition.strip().split(" and ")
                    all_and_conditions_met = True

                    for and_condition in and_conditions:
                        and_condition = and_condition.strip().strip(
                            "()"
                        )  # Убираем скобки
                        condition_result = evaluate_formula(
                            and_condition, variables, is_condition=True
                        )
                        if not condition_result:
                            all_and_conditions_met = False
                            break

                    if all_and_conditions_met:
                        any_or_condition_met = True
                        break

                if any_or_condition_met:
                    range_formula = _normalize_formula_text(range_item["formula"])
                    prepared = _decimalize_formula_literals(range_formula)
                    return _eval_numeric_result(
                        eval(prepared, {"__builtins__": None}, safe_dict)
                    )

            # Если ни одно условие не выполнилось, возвращаем 0
            return Decimal("0")

        # Проверяем, является ли формула простым числом
        try:
            return parse_decimal_value(formula.strip().replace(",", "."))
        except Exception:
            pass

        # Создаем словарь переменных для обычного расчета
        decimal_vars = {}
        for name, value in variables.items():
            try:
                new_name = _replace_subscript_digits(name)
                decimal_vars[new_name] = _formula_variable_value(value)
            except Exception as e:
                raise ValueError(
                    f"Ошибка преобразования значения {name} = {value} в число: {str(e)}"
                )

        safe_dict = _formula_safe_dict(decimal_vars)

        if is_condition:
            # Проверяем наличие OR в условии
            if " or " in formula:
                or_conditions = formula.split(" or ")
                for or_condition in or_conditions:
                    # Для каждого OR условия проверяем AND условия
                    and_conditions = or_condition.strip().split(" and ")
                    all_and_conditions_met = True

                    for and_condition in and_conditions:
                        and_condition = and_condition.strip().strip("()")
                        condition_result = evaluate_formula(
                            and_condition, variables, is_condition=True
                        )
                        if not condition_result:
                            all_and_conditions_met = False
                            break

                    if all_and_conditions_met:
                        return True
                return False
            # Проверяем наличие AND в условии
            elif " and " in formula:
                and_conditions = formula.split(" and ")
                for and_condition in and_conditions:
                    and_condition = and_condition.strip().strip("()")
                    condition_result = evaluate_formula(
                        and_condition, variables, is_condition=True
                    )
                    if not condition_result:
                        return False
                return True
            else:
                # Для условий разбиваем формулу на части
                for operator in ["<=", ">=", ">", "<", "="]:
                    if operator in formula:
                        left, right = formula.split(operator)
                        left_result = _eval_numeric_result(
                            eval(
                                _decimalize_formula_literals(left),
                                {"__builtins__": None},
                                safe_dict,
                            )
                        )
                        right_result = _eval_numeric_result(
                            eval(
                                _decimalize_formula_literals(right),
                                {"__builtins__": None},
                                safe_dict,
                            )
                        )

                        if operator == "<=":
                            return left_result <= right_result
                        if operator == ">=":
                            return left_result >= right_result
                        if operator == ">":
                            return left_result > right_result
                        if operator == "<":
                            return left_result < right_result
                        return left_result == right_result

                raise ValueError(
                    f"Неподдерживаемый оператор сравнения в формуле: {formula}"
                )
        else:
            prepared = _decimalize_formula_literals(formula)
            result = _eval_numeric_result(
                eval(prepared, {"__builtins__": None}, safe_dict)
            )

            # Применяем округление, если заданы параметры
            if rounding_params:
                if rounding_params.get("use_multiple_rounding"):
                    multiple_raw = rounding_params.get("multiple_value")
                    rounding_type = rounding_params.get("rounding_type")
                    if rounding_type == "multiple" or multiple_raw not in (None, ""):
                        multiple = parse_decimal_value(multiple_raw or "1")
                        result = _round_to_multiple(result, multiple)
                    elif rounding_type in ("decimal", "significant") and (
                        rounding_params.get("rounding_decimal") is not None
                    ):
                        result = round_result(
                            result,
                            rounding_type,
                            rounding_params.get("rounding_decimal"),
                        )
                elif (
                    rounding_params.get("rounding_type")
                    in (
                        "decimal",
                        "significant",
                    )
                    and rounding_params.get("rounding_decimal") is not None
                ):
                    result = round_result(
                        result,
                        rounding_params.get("rounding_type"),
                        rounding_params.get("rounding_decimal"),
                    )

            return result

    except Exception as e:
        raise ValueError(f"Ошибка при вычислении формулы '{formula}': {str(e)}")


def _format_step_decimal(value: Decimal) -> str:
    """Число для отображения в шагах повторяемости."""
    text = format(value.normalize(), "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text.replace(".", ",")


def calculate_convergence_steps(formula, variables):
    """Вычисляет шаги расчета повторяемости."""
    try:
        normalized_formula = _normalize_formula_text(formula)
        step1 = normalized_formula
        for name, value in variables.items():
            if isinstance(value, str):
                value = value.strip().replace(",", ".")
            step1 = step1.replace(name, str(value))
            sub_name = _replace_subscript_digits(name)
            if sub_name != name:
                step1 = step1.replace(sub_name, str(value))

        safe_dict = _formula_safe_dict({})

        if " or " in normalized_formula:
            or_conditions = step1.split(" or ")
            steps = []
            for or_condition in or_conditions:
                if " and " in or_condition:
                    and_conditions = or_condition.strip().split(" and ")
                    and_steps = []
                    for and_condition in and_conditions:
                        and_condition = and_condition.strip().strip("()")
                        step = _calculate_single_condition(and_condition, safe_dict)
                        if step:
                            and_steps.append(step)
                    if and_steps:
                        steps.append({"type": "and", "conditions": and_steps})
                else:
                    step = _calculate_single_condition(
                        or_condition.strip().strip("()"), safe_dict
                    )
                    if step:
                        steps.append({"type": "single", "condition": step})
            return {"type": "or", "steps": steps}
        if " and " in normalized_formula:
            and_conditions = step1.split(" and ")
            steps = []
            for and_condition in and_conditions:
                step = _calculate_single_condition(
                    and_condition.strip().strip("()"), safe_dict
                )
                if step:
                    steps.append(step)
            return {"type": "and", "steps": steps}
        else:
            # Обрабатываем простое условие
            step = _calculate_single_condition(step1, safe_dict)
            if step:
                return {"type": "single", "step": step}

        return None
    except Exception as e:
        logger.error(f"Ошибка при вычислении шагов повторяемости: {str(e)}")
        return None


def _calculate_single_condition(condition, safe_dict):
    """Вычисляет шаги для одиночного условия."""
    for operator in ["<=", ">=", ">", "<", "="]:
        if operator in condition:
            left, right = condition.split(operator, 1)
            try:
                left_prepared = _decimalize_formula_literals(left.strip())
                right_prepared = _decimalize_formula_literals(right.strip())
                left_result = _eval_numeric_result(
                    eval(left_prepared, {"__builtins__": None}, safe_dict)
                )
                right_result = _eval_numeric_result(
                    eval(right_prepared, {"__builtins__": None}, safe_dict)
                )

                left_str = _format_step_decimal(left_result)
                right_str = _format_step_decimal(right_result)

                return {
                    "original": condition.replace("*", "×").replace("/", "÷"),
                    "evaluated": f"{left_str}{operator}{right_str}",
                }
            except Exception as e:
                logger.error(f"Ошибка при вычислении условия {condition}: {str(e)}")
                return None
    return None


def get_pressure_correction_coefficient(patm):
    """Определяет коэффициент поправки на атмосферное давление для фракционного состава."""
    try:
        patm_value = parse_decimal_value(patm)

        if (patm_value < 750 and patm_value >= 740) or (
            patm_value > 770 and patm_value <= 780
        ):
            return 1
        if (patm_value < 740 and patm_value >= 730) or (
            patm_value > 780 and patm_value <= 790
        ):
            return 2
        if (patm_value < 730 and patm_value >= 720) or (
            patm_value > 790 and patm_value <= 800
        ):
            return 3
        return 0
    except (ValueError, TypeError):
        return 0


def get_temperature_correction_table():
    """Возвращает таблицу поправок на температуру для фракционного состава."""
    return {
        (11, 20): 0.35,
        (21, 30): 0.36,
        (31, 40): 0.37,
        (41, 50): 0.38,
        (51, 60): 0.39,
        (61, 70): 0.41,
        (71, 80): 0.42,
        (81, 90): 0.43,
        (91, 100): 0.44,
        (101, 110): 0.45,
        (111, 120): 0.47,
        (121, 130): 0.48,
        (131, 140): 0.49,
        (141, 150): 0.50,
        (151, 160): 0.51,
        (161, 170): 0.53,
        (171, 180): 0.54,
        (181, 190): 0.55,
        (191, 200): 0.56,
        (201, 210): 0.57,
        (211, 220): 0.59,
        (221, 230): 0.60,
        (231, 240): 0.61,
        (241, 250): 0.62,
        (251, 260): 0.63,
        (261, 270): 0.65,
        (271, 280): 0.66,
        (281, 290): 0.67,
        (291, 300): 0.68,
        (301, 310): 0.69,
        (311, 320): 0.71,
        (321, 330): 0.72,
        (331, 340): 0.73,
        (341, 350): 0.74,
        (351, 360): 0.75,
    }


def get_temperature_correction(temperature, patm):
    """Определяет поправку на температуру для фракционного состава."""
    try:
        temp_value = parse_decimal_value(temperature)

        if temp_value > 360:
            return Decimal("0")

        pressure_coeff = get_pressure_correction_coefficient(patm)
        if pressure_coeff == 0:
            return Decimal("0")

        correction_table = get_temperature_correction_table()

        for (min_temp, max_temp), correction_value in correction_table.items():
            if min_temp <= temp_value <= max_temp:
                final_correction = Decimal(str(correction_value)) * pressure_coeff

                patm_value = parse_decimal_value(patm)
                if patm_value > 770:
                    return -final_correction
                if patm_value < 750:
                    return final_correction
                return Decimal("0")

        return Decimal("0")
    except (ValueError, TypeError):
        return Decimal("0")
