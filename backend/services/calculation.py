from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from core.exceptions import ConflictError, NotFoundError, ValidationError
from core.logger import logger
from models.calculation import Calculation
from models.laboratory import Department, Laboratory
from models.research import ResearchMethod
from models.sample import MassFractionOilRefractionTable, Sample
from schemas.calculation import CalculationCreate, CalculationUpdate
from utils.filters import add_list_filter
from utils.pagination import apply_pagination, calculate_total_pages, get_total_count
from utils.sorting import build_order_by


async def get_calculation_by_id(
    db: AsyncSession, calculation_id: int, include_deleted: bool = False
) -> Optional[Calculation]:
    """Получить расчет по ID."""
    query = (
        select(Calculation)
        .where(Calculation.id == calculation_id)
        .options(
            selectinload(Calculation.sample),
            selectinload(Calculation.laboratory),
            selectinload(Calculation.department),
            selectinload(Calculation.research_method),
        )
    )
    if not include_deleted:
        query = query.where(Calculation.deleted_at.is_(None))
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_calculations_by_sample(
    db: AsyncSession,
    sample_id: Optional[int] = None,
    sample_ids: Optional[List[int]] = None,
    include_deleted: bool = False,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> List[Calculation]:
    """Получить список расчетов по пробе без пагинации."""
    query = select(Calculation).options(
        selectinload(Calculation.sample),
        selectinload(Calculation.laboratory),
        selectinload(Calculation.department),
        selectinload(Calculation.research_method),
    )

    if not include_deleted:
        query = query.where(Calculation.deleted_at.is_(None))

    conditions = []
    if sample_id:
        conditions.append(Calculation.sample_id == sample_id)
    elif sample_ids:
        conditions.append(Calculation.sample_id.in_(sample_ids))
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "created_at": Calculation.created_at,
        "laboratory_activity_date": Calculation.laboratory_activity_date,
    }
    order_by = build_order_by(sort_by, sort_order, sort_mapping, Calculation.created_at)
    query = query.order_by(order_by)

    result = await db.execute(query)
    calculations = result.scalars().all()

    return calculations


async def get_calculations(
    db: AsyncSession,
    sample_id: Optional[int] = None,
    sample_ids: Optional[List[int]] = None,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
    research_method_id: Optional[int] = None,
    include_deleted: bool = False,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[List[Calculation], int, int]:
    """Получить список расчетов."""
    query = select(Calculation).options(
        selectinload(Calculation.sample),
        selectinload(Calculation.laboratory),
        selectinload(Calculation.department),
        selectinload(Calculation.research_method),
    )

    if not include_deleted:
        query = query.where(Calculation.deleted_at.is_(None))

    conditions = []
    if sample_id:
        conditions.append(Calculation.sample_id == sample_id)
    elif sample_ids:
        conditions.append(Calculation.sample_id.in_(sample_ids))
    if laboratory_id:
        conditions.append(Calculation.laboratory_id == laboratory_id)
    if department_id:
        conditions.append(Calculation.department_id == department_id)
    if research_method_id:
        conditions.append(Calculation.research_method_id == research_method_id)
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "created_at": Calculation.created_at,
        "laboratory_activity_date": Calculation.laboratory_activity_date,
    }
    order_by = build_order_by(sort_by, sort_order, sort_mapping, Calculation.created_at)
    query = query.order_by(order_by)

    count_query = select(func.count()).select_from(Calculation)
    if not include_deleted:
        count_query = count_query.where(Calculation.deleted_at.is_(None))
    count_conditions = []
    if sample_id:
        count_conditions.append(Calculation.sample_id == sample_id)
    elif sample_ids:
        count_conditions.append(Calculation.sample_id.in_(sample_ids))
    if laboratory_id:
        count_conditions.append(Calculation.laboratory_id == laboratory_id)
    if department_id:
        count_conditions.append(Calculation.department_id == department_id)
    if research_method_id:
        count_conditions.append(Calculation.research_method_id == research_method_id)
    if count_conditions:
        count_query = count_query.where(*count_conditions)

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        total_pages = calculate_total_pages(total, page_size)
        query = apply_pagination(query, page, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    result = await db.execute(query)
    calculations = result.scalars().all()

    return calculations, total, total_pages


async def create_calculation(
    db: AsyncSession, calculation_data: CalculationCreate
) -> Calculation:
    """Создать расчет."""
    sample = await db.execute(
        select(Sample).where(Sample.id == calculation_data.sample_id)
    )
    sample_obj = sample.scalar_one_or_none()
    if not sample_obj:
        raise NotFoundError("Проба не найдена")

    laboratory = await db.execute(
        select(Laboratory).where(Laboratory.id == calculation_data.laboratory_id)
    )
    if not laboratory.scalar_one_or_none():
        raise NotFoundError("Лаборатория не найдена")

    if calculation_data.department_id:
        department = await db.execute(
            select(Department).where(Department.id == calculation_data.department_id)
        )
        dept = department.scalar_one_or_none()
        if not dept:
            raise NotFoundError("Подразделение не найдено")
        if dept.laboratory_id != calculation_data.laboratory_id:
            raise ValidationError(
                "Подразделение должно принадлежать выбранной лаборатории"
            )

    research_method = await db.execute(
        select(ResearchMethod).where(
            ResearchMethod.id == calculation_data.research_method_id
        )
    )
    if not research_method.scalar_one_or_none():
        raise NotFoundError("Метод исследования не найден")

    existing = await db.execute(
        select(Calculation).where(
            Calculation.sample_id == calculation_data.sample_id,
            Calculation.research_method_id == calculation_data.research_method_id,
            Calculation.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictError(
            "Расчет для данной пробы и метода исследования уже существует"
        )

    calculation = Calculation(
        input_data=calculation_data.input_data,
        equipment_data=calculation_data.equipment_data or [],
        result=calculation_data.result,
        executor=calculation_data.executor,
        measurement_error=calculation_data.measurement_error,
        unit=calculation_data.unit,
        laboratory_activity_date=calculation_data.laboratory_activity_date,
        sample_id=calculation_data.sample_id,
        laboratory_id=calculation_data.laboratory_id,
        department_id=calculation_data.department_id,
        research_method_id=calculation_data.research_method_id,
    )
    db.add(calculation)
    await db.flush()
    return calculation


async def update_calculation(
    db: AsyncSession, calculation_id: int, calculation_data: CalculationUpdate
) -> Calculation:
    """Обновить расчет."""
    calculation = await get_calculation_by_id(db, calculation_id)
    if not calculation:
        raise NotFoundError("Расчет не найден")

    update_data = calculation_data.model_dump(exclude_unset=True)

    if "sample_id" in update_data or "research_method_id" in update_data:
        sample_id = update_data.get("sample_id", calculation.sample_id)
        method_id = update_data.get(
            "research_method_id", calculation.research_method_id
        )

        existing = await db.execute(
            select(Calculation).where(
                Calculation.sample_id == sample_id,
                Calculation.research_method_id == method_id,
                Calculation.id != calculation_id,
                Calculation.deleted_at.is_(None),
            )
        )
        if existing.scalar_one_or_none():
            raise ConflictError(
                "Расчет для данной пробы и метода исследования уже существует"
            )

    for key, value in update_data.items():
        setattr(calculation, key, value)

    if (
        calculation_data.laboratory_id is not None
        or calculation_data.department_id is not None
    ):
        lab_id = (
            calculation_data.laboratory_id
            if calculation_data.laboratory_id is not None
            else calculation.laboratory_id
        )
        dept_id = (
            calculation_data.department_id
            if calculation_data.department_id is not None
            else calculation.department_id
        )

        if dept_id:
            department = await db.execute(
                select(Department).where(Department.id == dept_id)
            )
            dept = department.scalar_one_or_none()
            if not dept:
                raise NotFoundError("Подразделение не найдено")
            if lab_id and dept.laboratory_id != lab_id:
                raise ValidationError(
                    "Подразделение должно принадлежать выбранной лаборатории"
                )

    await db.flush()
    return calculation


async def delete_calculation(db: AsyncSession, calculation_id: int) -> None:
    """Удалить расчет (мягкое удаление)."""
    calculation = await get_calculation_by_id(db, calculation_id)
    if not calculation:
        raise NotFoundError("Расчет не найден")

    calculation.soft_delete()
    await db.flush()


# ============================================================================
# Функции для работы с формулами, округлениями и сходимостью
# ============================================================================


def _round_to_significant_figures(number, significant_figures):
    """
    Округляет число до заданного количества значащих цифр.
    """
    if number == 0:
        return 0

    d = Decimal(str(float(number)))
    str_num = f"{d:E}"
    mantissa, exp = str_num.split("E")
    exp = int(exp)
    mantissa = mantissa.replace(".", "").rstrip("0")

    if len(mantissa) > significant_figures:
        decimal_mantissa = Decimal(mantissa[: significant_figures + 1]) / Decimal("10")
        mantissa = str(decimal_mantissa.quantize(Decimal("1"), rounding=ROUND_HALF_UP))

    mantissa = mantissa.ljust(significant_figures, "0")

    if exp >= 0:
        if exp + 1 >= len(mantissa):
            result = Decimal(mantissa + "0" * (exp + 1 - len(mantissa)))
        else:
            result = Decimal(mantissa[: exp + 1] + "." + mantissa[exp + 1 :])
    else:
        result = Decimal("0." + "0" * (-exp - 1) + mantissa)

    return result


def _round_to_multiple(number, multiple):
    """
    Округляет число до ближайшего кратного заданному числу.
    """
    try:
        d = Decimal(str(float(number)))
        m = Decimal(str(float(multiple)))
        return Decimal(round(d / m) * m)
    except Exception as e:
        raise ValueError(f"Ошибка при округлении до кратного: {str(e)}")


def round_result(result, rounding_type, rounding_decimal):
    """
    Округляет результат по заданному типу и количеству знаков.
    """
    if rounding_type == "decimal":
        d = Decimal(str(float(result)))
        # Используем ROUND_HALF_UP для округления 0.5 вверх
        return d.quantize(Decimal("0.1") ** rounding_decimal, rounding=ROUND_HALF_UP)
    else:
        return _round_to_significant_figures(result, rounding_decimal)


def _replace_subscript_digits(text):
    """
    Заменяет подстрочные символы на обычные.
    """
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


def evaluate_formula(
    formula, variables, is_condition=False, range_calculation=None, rounding_params=None
):
    """
    Вычисляет результат формулы.
    """
    try:
        formula = _replace_subscript_digits(formula)
        formula = formula.replace("×", "*").replace("÷", "/")

        # Если есть диапазонный расчет, сразу его применяем
        if not is_condition and range_calculation and "ranges" in range_calculation:
            # Создаем словарь переменных для диапазонного расчета
            decimal_vars = {}
            for name, value in variables.items():
                try:
                    if isinstance(value, str):
                        value = value.strip().replace(",", ".")
                    new_name = _replace_subscript_digits(name)
                    decimal_vars[new_name] = float(value)
                except Exception as e:
                    raise ValueError(
                        f"Ошибка преобразования значения {name} = {value} в число: {str(e)}"
                    )

            safe_dict = {
                "__builtins__": {},
                "abs": abs,
                "pow": pow,
                "round": round,
                "max": max,
                "min": min,
            }
            safe_dict.update(decimal_vars)

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
                    # Если условие выполняется, вычисляем формулу из диапазона
                    result = float(
                        eval(range_item["formula"], {"__builtins__": None}, safe_dict)
                    )
                    return Decimal(str(result))

            # Если ни одно условие не выполнилось, возвращаем 0
            return Decimal("0")

        # Проверяем, является ли формула простым числом
        try:
            return Decimal(str(float(formula)))
        except ValueError:
            pass

        # Создаем словарь переменных для обычного расчета
        decimal_vars = {}
        for name, value in variables.items():
            try:
                if isinstance(value, str):
                    value = value.strip().replace(",", ".")
                new_name = _replace_subscript_digits(name)
                decimal_vars[new_name] = float(value)
            except Exception as e:
                raise ValueError(
                    f"Ошибка преобразования значения {name} = {value} в число: {str(e)}"
                )

        safe_dict = {
            "__builtins__": {},
            "abs": abs,
            "pow": pow,
            "round": round,
            "max": max,
            "min": min,
        }
        safe_dict.update(decimal_vars)

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
                        # Вычисляем левую и правую части
                        left_result = float(
                            eval(left, {"__builtins__": None}, safe_dict)
                        )
                        right_result = float(
                            eval(right, {"__builtins__": None}, safe_dict)
                        )

                        # Добавляем эпсилон для сравнения чисел с плавающей точкой
                        epsilon = 1e-10

                        if operator == "<=":
                            return left_result <= (right_result + epsilon)
                        elif operator == ">=":
                            return left_result >= (right_result - epsilon)
                        elif operator == ">":
                            return left_result > (right_result + epsilon)
                        elif operator == "<":
                            return left_result < (right_result - epsilon)
                        else:  # =
                            return abs(left_result - right_result) < 1e-10

                raise ValueError(
                    f"Неподдерживаемый оператор сравнения в формуле: {formula}"
                )
        else:
            result = float(eval(formula, {"__builtins__": None}, safe_dict))
            result = Decimal(str(result))

            # Применяем округление, если заданы параметры
            if rounding_params:
                if rounding_params.get("use_multiple_rounding"):
                    if rounding_params.get("rounding_type") == "multiple":
                        multiple = float(rounding_params.get("multiple_value", "1"))
                        result = _round_to_multiple(result, multiple)
                    else:
                        result = round_result(
                            result,
                            rounding_params.get("rounding_type"),
                            rounding_params.get("rounding_decimal"),
                        )

            return result

    except Exception as e:
        raise ValueError(f"Ошибка при вычислении формулы '{formula}': {str(e)}")


def calculate_convergence_steps(formula, variables):
    """
    Вычисляет шаги расчета повторяемости.
    """
    try:
        # Заменяем переменные на их значения
        step1 = formula
        for name, value in variables.items():
            if isinstance(value, str):
                value = value.strip().replace(",", ".")
            step1 = step1.replace(name, str(value))

        safe_dict = {
            "abs": abs,
            "pow": pow,
            "round": round,
            "max": max,
            "min": min,
        }

        # Обрабатываем сложные условия
        if " or " in formula:
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
        elif " and " in formula:
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
    """
    Вычисляет шаги для одиночного условия.
    """
    for operator in ["<=", ">=", ">", "<", "="]:
        if operator in condition:
            left, right = condition.split(operator)
            try:
                left_result = float(eval(left, {"__builtins__": {}}, safe_dict))
                right_result = float(eval(right, {"__builtins__": {}}, safe_dict))

                left_str = f"{left_result:g}".replace(".", ",")
                right_str = f"{right_result:g}".replace(".", ",")

                return {
                    "original": condition.replace("*", "×").replace("/", "÷"),
                    "evaluated": f"{left_str}{operator}{right_str}",
                }
            except Exception as e:
                logger.error(f"Ошибка при вычислении условия {condition}: {str(e)}")
                return None
    return None


def get_pressure_correction_coefficient(patm):
    """
    Определяет коэффициент поправки на атмосферное давление для фракционного состава.
    """
    try:
        patm_value = float(str(patm).replace(",", "."))

        if (patm_value < 750 and patm_value >= 740) or (
            patm_value > 770 and patm_value <= 780
        ):
            return 1  # x1
        elif (patm_value < 740 and patm_value >= 730) or (
            patm_value > 780 and patm_value <= 790
        ):
            return 2  # x2
        elif (patm_value < 730 and patm_value >= 720) or (
            patm_value > 790 and patm_value <= 800
        ):
            return 3  # x3
        else:
            return 0  # Нет поправки
    except (ValueError, TypeError):
        return 0


def get_temperature_correction_table():
    """
    Возвращает таблицу поправок на температуру для фракционного состава.
    """
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
    """
    Определяет поправку на температуру для фракционного состава.
    """
    try:
        temp_value = float(str(temperature).replace(",", "."))

        # Если температура больше 360, поправку не вносим
        if temp_value > 360:
            return 0

        pressure_coeff = get_pressure_correction_coefficient(patm)
        if pressure_coeff == 0:
            return 0

        correction_table = get_temperature_correction_table()

        for (min_temp, max_temp), correction_value in correction_table.items():
            if min_temp <= temp_value <= max_temp:
                final_correction = correction_value * pressure_coeff

                patm_value = float(str(patm).replace(",", "."))
                if patm_value > 770:  # Уменьшаем температуру
                    return -final_correction
                elif patm_value < 750:  # Увеличиваем температуру
                    return final_correction
                else:
                    return 0

        return 0
    except (ValueError, TypeError):
        return 0


async def calculate_mass_fraction_from_refraction(
    db: AsyncSession, n_value: float, research_method_id: int
):
    """
    Вычисляет массовую долю нефти (C) по показателю преломления (n) с использованием линейной интерполяции.
    Использует данные из MassFractionOilRefractionTable для указанного метода исследования.
    """
    try:
        if isinstance(n_value, str):
            n_value = float(n_value.replace(",", "."))
        else:
            n_value = float(n_value)

        result = await db.execute(
            select(MassFractionOilRefractionTable)
            .where(
                MassFractionOilRefractionTable.research_method_id == research_method_id,
                MassFractionOilRefractionTable.deleted_at.is_(None),
            )
            .order_by(MassFractionOilRefractionTable.c_value)
        )
        table_entries = result.scalars().all()

        if not table_entries:
            logger.warning(
                f"Не найдено активных записей в таблице для метода {research_method_id}"
            )
            return 0.0

        # Обрабатываем повторяющиеся значения n_value, добавляя 0.005 для каждого следующего
        points = []
        n_value_counts = {}

        for entry in table_entries:
            c_val = float(entry.c_value)
            n_val = float(entry.n_value)
            original_n_val = n_val

            # Если значение n уже встречалось, добавляем 0.005
            if original_n_val in n_value_counts:
                n_value_counts[original_n_val] += 1
                n_val = original_n_val + (n_value_counts[original_n_val] - 1) * 0.005
            else:
                n_value_counts[original_n_val] = 1

            points.append((c_val, n_val))

        # Сортируем по n_value
        points.sort(key=lambda x: x[1])

        # Проверяем граничные случаи
        min_n = points[0][1]
        max_n = points[-1][1]

        if n_value < min_n:
            return 0.0
        if n_value > max_n:
            return 100.0

        # Ищем две ближайшие точки для интерполяции
        for i in range(len(points) - 1):
            n1, c1 = points[i][1], points[i][0]
            n2, c2 = points[i + 1][1], points[i + 1][0]

            if n1 <= n_value <= n2:
                # Линейная интерполяция
                if n2 == n1:
                    c_result = c1
                else:
                    c_result = c1 + (c2 - c1) * (n_value - n1) / (n2 - n1)

                # Округляем до одной цифры после запятой
                return round(c_result, 1)

        # Если не нашли интервал (не должно произойти), возвращаем последнее значение
        return round(points[-1][0], 1)

    except Exception as e:
        logger.error(f"Ошибка при расчете массовой доли нефти: {str(e)}")
        return 0.0
