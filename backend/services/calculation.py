import re
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, List, NamedTuple, Optional
from sqlalchemy import Float, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from core.exceptions import ConflictError, NotFoundError, ValidationError
from core.logger import logger
from models.calculation import Calculation
from models.laboratory import Department, Laboratory
from models.research import ResearchMethod
from models.sample import MassFractionOilRefractionTable, Sample
from schemas.calculation import (
    CalculationCreate,
    CalculationUpdate,
    MethodologyChoiceResponse,
)
from services.research import (
    get_active_research_method_by_name,
    get_research_method_by_id,
)
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
            selectinload(Calculation.sample).selectinload(Sample.laboratory),
            selectinload(Calculation.sample).selectinload(Sample.department),
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


async def get_calculation_methodology_choice(
    db: AsyncSession,
    calculation_id: int,
) -> MethodologyChoiceResponse:
    """Проверить, появилась ли новая версия методики для сохранённого расчёта."""
    calculation = await get_calculation_by_id(db, calculation_id)
    if not calculation:
        raise NotFoundError("Расчет не найден")

    stored_method = await get_research_method_by_id(
        db, calculation.research_method_id, include_deleted=True
    )
    if not stored_method:
        raise NotFoundError("Метод исследования не найден")

    stored_method_deleted = stored_method.deleted_at is not None
    current_method = await get_active_research_method_by_name(
        db,
        name=stored_method.name,
        laboratory_id=calculation.laboratory_id,
        department_id=calculation.department_id,
    )

    methodology_changed = (
        stored_method_deleted
        and current_method is not None
        and current_method.id != stored_method.id
    )

    return MethodologyChoiceResponse(
        methodology_changed=methodology_changed,
        method_name=stored_method.name,
        stored_method_id=stored_method.id,
        stored_method_deleted=stored_method_deleted,
        current_method_id=current_method.id if current_method else None,
    )


async def _validate_research_method_version_change(
    db: AsyncSession,
    old_method_id: int,
    new_method_id: int,
    laboratory_id: int,
    department_id: Optional[int],
) -> None:
    """Разрешить смену метода только при переходе на актуальную версию той же методики."""
    old_method = await get_research_method_by_id(
        db, old_method_id, include_deleted=True
    )
    new_method = await get_research_method_by_id(
        db, new_method_id, include_deleted=False
    )
    if not old_method:
        raise NotFoundError("Исходный метод исследования не найден")
    if not new_method:
        raise NotFoundError("Новый метод исследования не найден")
    if old_method.name != new_method.name:
        raise ValidationError(
            "Новая методика должна иметь то же наименование, что и в сохранённом расчёте"
        )
    if old_method.laboratory_id != new_method.laboratory_id:
        raise ValidationError("Новая методика должна относиться к той же лаборатории")
    old_department = (
        old_method.department_id if old_method.department_id is not None else None
    )
    new_department = (
        new_method.department_id if new_method.department_id is not None else None
    )
    if old_department != new_department:
        raise ValidationError(
            "Новая методика должна относиться к тому же подразделению"
        )
    if old_method.deleted_at is None:
        raise ValidationError("При замене расчёта нельзя менять метод исследования")

    active_method = await get_active_research_method_by_name(
        db,
        name=new_method.name,
        laboratory_id=laboratory_id,
        department_id=department_id,
    )
    if not active_method or active_method.id != new_method.id:
        raise ValidationError(
            "Новая методика должна быть актуальной версией в справочнике"
        )


async def replace_calculation(
    db: AsyncSession,
    calculation_id: int,
    calculation_data: CalculationCreate,
) -> Calculation:
    """Мягко удаляет расчёт по id и создаёт новую запись с теми же пробой и методом."""
    old = await get_calculation_by_id(db, calculation_id)
    if not old:
        raise NotFoundError("Расчет не найден")

    if calculation_data.sample_id != old.sample_id:
        raise ValidationError("При замене расчёта нельзя менять пробу")
    if calculation_data.research_method_id != old.research_method_id:
        await _validate_research_method_version_change(
            db,
            old_method_id=old.research_method_id,
            new_method_id=calculation_data.research_method_id,
            laboratory_id=calculation_data.laboratory_id,
            department_id=calculation_data.department_id,
        )
    if calculation_data.laboratory_id != old.laboratory_id:
        raise ValidationError("При замене расчёта нельзя менять лабораторию")

    old_department = old.department_id if old.department_id is not None else None
    new_department = (
        calculation_data.department_id
        if calculation_data.department_id is not None
        else None
    )
    if old_department != new_department:
        raise ValidationError("При замене расчёта нельзя менять подразделение")

    old.soft_delete()
    await db.flush()
    return await create_calculation(db, calculation_data)


# ============================================================================
# Функции для работы с формулами, округлениями и повторяемостью
# ============================================================================


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
    """
    Округляет число до ближайшего кратного заданному числу.
    """
    try:
        d = parse_decimal_value(number)
        m = parse_decimal_value(multiple)
        quotient = (d / m).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        return quotient * m
    except Exception as e:
        raise ValueError(f"Ошибка при округлении до кратного: {str(e)}")


def round_result(result, rounding_type, rounding_decimal):
    """
    Округляет результат по заданному типу и количеству знаков.
    """
    if rounding_type == "decimal":
        return round_decimal_half_up(result, rounding_decimal)
    return round_significant_half_up(result, rounding_decimal)


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
    """
    Вычисляет результат формулы.
    """
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
    """
    Вычисляет шаги расчета повторяемости.
    """
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
    """
    Вычисляет шаги для одиночного условия.
    """
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
    """
    Определяет коэффициент поправки на атмосферное давление для фракционного состава.
    """
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


class MassFractionFromRefractionOutcome(NamedTuple):
    """numeric — формулы; stored_display — в input_data (сохранение); ниже ПНР — «0,00»."""

    numeric: Decimal
    stored_display: str
    below_detection_limit: bool


_MF_OIL_N_DUPLICATE_OFFSET = Decimal("0.005")


def _mf_oil_display_from_decimal(value: Decimal) -> str:
    text = format(value.normalize(), "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text.replace(".", ",")


async def calculate_mass_fraction_from_refraction(
    db: AsyncSession, n_value: Any, research_method_id: int
) -> MassFractionFromRefractionOutcome:
    """
    Вычисляет массовую долю нефти (C) по показателю преломления (n) с использованием линейной интерполяции.
    Использует данные из MassFractionOilRefractionTable для указанного метода исследования.
    """
    try:
        n_value = parse_decimal_value(n_value)

        result = await db.execute(
            select(MassFractionOilRefractionTable)
            .where(
                MassFractionOilRefractionTable.research_method_id == research_method_id,
                MassFractionOilRefractionTable.deleted_at.is_(None),
            )
            .order_by(cast(MassFractionOilRefractionTable.c_value, Float))
        )
        table_entries = result.scalars().all()

        if not table_entries:
            logger.warning(
                f"Не найдено активных записей в таблице для метода {research_method_id}"
            )
            return MassFractionFromRefractionOutcome(Decimal("0"), "0", False)

        n_at_c_zero: List[Decimal] = []
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
                n_val = original_n_val + (
                    (n_value_counts[original_n_val] - 1) * _MF_OIL_N_DUPLICATE_OFFSET
                )
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
                if n2 == n1:
                    c_result = c1
                else:
                    c_result = c1 + (c2 - c1) * (n_value - n1) / (n2 - n1)

                rounded = round_decimal_half_up(c_result, 1)
                return MassFractionFromRefractionOutcome(
                    rounded, _mf_oil_display_from_decimal(rounded), False
                )

        rounded = round_decimal_half_up(points[-1][0], 1)
        return MassFractionFromRefractionOutcome(
            rounded, _mf_oil_display_from_decimal(rounded), False
        )

    except Exception as e:
        logger.error(f"Ошибка при расчете массовой доли нефти: {str(e)}")
        return MassFractionFromRefractionOutcome(Decimal("0"), "0", False)
