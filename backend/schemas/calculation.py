from __future__ import annotations
from datetime import date, datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field
from schemas.common import ExecutorHsnils, OptionalExecutorHsnils


class CalculationBase(BaseModel):
    input_data: dict[str, Any] = Field(..., description="Входные данные для расчета")
    equipment_data: list[int] | None = Field(None, description="Список ID приборов")
    result: str = Field(..., description="Итоговый результат расчета")
    executor: ExecutorHsnils = Field(..., description="hsnils исполнителя, производившего расчет")
    measurement_error: str | None = Field(
        None,
        max_length=20,
        description="Погрешность измерения результата в формате ±число",
    )
    unit: str | None = Field(None, max_length=20, description="Единица измерения результата")
    laboratory_activity_date: date = Field(..., description="Дата проведения лабораторного исследования")


class CalculationCreate(CalculationBase):
    sample_id: int = Field(..., description="ID пробы")
    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: int | None = Field(None, description="ID подразделения")
    research_method_id: int = Field(..., description="ID метода исследования")


class CalculationUpdate(BaseModel):
    input_data: dict[str, Any] | None = None
    equipment_data: list[int] | None = None
    result: str | None = None
    executor: OptionalExecutorHsnils = None
    measurement_error: str | None = Field(None, max_length=20)
    unit: str | None = Field(None, max_length=20)
    laboratory_activity_date: date | None = None
    sample_id: int | None = None
    laboratory_id: int | None = None
    department_id: int | None = None
    research_method_id: int | None = None


class EquipmentBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    serial_number: str
    verification_info: str
    verification_date: date
    verification_end_date: date
    type: str
    version: str


class CalculationResponse(CalculationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sample_id: int
    laboratory_id: int
    department_id: int | None = None
    research_method_id: int
    equipment: list[EquipmentBrief] | None = None
    sample: dict[str, Any] | None = None
    research_method: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class MethodologyChoiceCandidate(BaseModel):
    """Кандидат актуальной методики при неоднозначном совпадении."""

    id: int = Field(..., description="ID методики")
    name: str = Field(..., description="Отображаемое наименование методики")


class MethodologyChoiceResponse(BaseModel):
    """Статус методики при редактировании сохранённого расчёта."""

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
        description="Список актуальных методик при неоднозначном совпадении",
    )
    stored_method_group_id: int | None = Field(None, description="ID группы методики на момент расчёта")
    stored_method_group_name: str | None = Field(None, description="Наименование группы методики на момент расчёта")


class CalculateRequest(BaseModel):
    input_data: dict[str, Any] = Field(..., description="Входные данные для расчета")
    research_method_id: int = Field(..., description="ID метода исследования")
    equipment_data: list[int] | None = Field(None, description="Список ID приборов")
