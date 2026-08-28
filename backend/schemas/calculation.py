from __future__ import annotations
from datetime import date, datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field
from schemas.common import ExecutorHsnils, NonEmptyStr, OptionalExecutorHsnils, OptionalNonEmptyStr
from schemas.sample import SampleResponse


class CalculationBase(BaseModel):
    """Общие поля расчёта."""

    input_data: dict[str, Any] = Field(..., description="Входные данные для расчёта")
    equipment_data: list[int] | None = Field(None, description="Список ID приборов")
    result: NonEmptyStr = Field(..., description="Итоговый результат расчёта")
    executor: ExecutorHsnils = Field(..., description="hsnils исполнителя, производившего расчёт")
    measurement_error: str | None = Field(
        None,
        max_length=20,
        description="Погрешность измерения результата в формате ±число",
    )
    unit: str | None = Field(None, max_length=20, description="Единица измерения результата")
    laboratory_activity_date: date = Field(..., description="Дата проведения лабораторного исследования")


class CalculationCreate(CalculationBase):
    """Запрос на создание расчёта."""

    sample_id: int = Field(..., description="ID пробы")
    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: int | None = Field(None, description="ID подразделения")
    research_method_id: int = Field(..., description="ID метода исследования")


class CalculationUpdate(BaseModel):
    """Частичное обновление расчёта."""

    input_data: dict[str, Any] | None = None
    equipment_data: list[int] | None = None
    result: OptionalNonEmptyStr = None
    executor: OptionalExecutorHsnils = None
    measurement_error: str | None = Field(None, max_length=20)
    unit: str | None = Field(None, max_length=20)
    laboratory_activity_date: date | None = None
    sample_id: int | None = None
    laboratory_id: int | None = None
    department_id: int | None = None
    research_method_id: int | None = None


class EquipmentBrief(BaseModel):
    """Краткие сведения о приборе в ответе расчёта."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    serial_number: str
    verification_info: str
    verification_date: date
    verification_end_date: date
    type: str
    version: str


class ResearchMethodBrief(BaseModel):
    """Краткие сведения о методе исследования в ответе расчёта."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    unit: str | None = None


class CalculationResponse(CalculationBase):
    """Ответ API с данными расчёта."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    sample_id: int
    laboratory_id: int
    department_id: int | None = None
    research_method_id: int
    equipment: list[EquipmentBrief] | None = None
    sample: SampleResponse | None = None
    research_method: ResearchMethodBrief | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class MethodologyChoiceCandidate(BaseModel):
    """Вариант методики, когда актуальных методов несколько."""

    id: int = Field(..., description="ID методики")
    name: str = Field(..., description="Отображаемое наименование методики")


class MethodologyChoiceResponse(BaseModel):
    """Статус методики расчёта: устарела, удалена или нужно выбрать другую."""

    methodology_changed: bool = Field(
        ...,
        description="Есть ли более новая актуальная версия методики",
    )
    method_name: str = Field(..., description="Наименование методики")
    stored_method_id: int = Field(..., description="ID методики, зафиксированной в расчёте")
    stored_method_deleted: bool = Field(..., description="Удалена ли методика из расчёта в справочнике")
    current_method_id: int | None = Field(None, description="ID актуальной методики с тем же именем")
    methodology_ambiguous: bool = Field(
        default=False,
        description="Несколько подходящих актуальных методик, нужен выбор пользователя",
    )
    candidate_methods: list[MethodologyChoiceCandidate] = Field(
        default_factory=list,
        description="Варианты актуальных методик, если подходит несколько",
    )
    stored_method_group_id: int | None = Field(None, description="ID группы методики на момент расчёта")
    stored_method_group_name: str | None = Field(None, description="Наименование группы методики на момент расчёта")


class CalculateRequest(BaseModel):
    """Запрос на выполнение расчёта без сохранения."""

    input_data: dict[str, Any] = Field(..., description="Входные данные для расчёта")
    research_method_id: int = Field(..., description="ID метода исследования")
    equipment_data: list[int] | None = Field(None, description="Список ID приборов")


class IntermediateResultValue(BaseModel):
    """Промежуточный результат: отображаемое и справочное значения."""

    value: str
    reference: str


class CalculateResponse(BaseModel):
    """Ответ выполнения расчёта без сохранения."""

    result: str | None = Field(None, description="Итоговый результат")
    result_reference: str | None = Field(None, description="Справочное значение результата")
    result_display: str | None = Field(None, description="Отображаемое представление результата")
    measurement_error: str | None = Field(None, description="Погрешность измерения")
    unit: str | None = Field(None, description="Единица измерения")
    convergence: str | None = Field(None, description="Статус сходимости/повторяемости")
    intermediate_results: dict[str, str | IntermediateResultValue] | None = Field(
        None,
        description="Промежуточные результаты расчёта",
    )
    conditions_info: list[dict[str, Any]] | None = Field(
        None,
        description="Информация об условиях повторяемости",
    )
    is_fractional_composition: bool | None = Field(
        None,
        description="Признак расчёта фракционного состава",
    )
    updated_input_data: dict[str, Any] | None = Field(
        None,
        description="Обновлённые входные данные (для отдельных методик)",
    )
