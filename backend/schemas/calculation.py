import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class CalculationBase(BaseModel):
    input_data: Dict[str, Any] = Field(..., description="Входные данные для расчета")
    equipment_data: Optional[List[int]] = Field(None, description="Список ID приборов")
    result: str = Field(..., description="Итоговый результат расчета")
    executor: str = Field(
        ..., min_length=2, description="hsnils исполнителя, производившего расчет"
    )
    measurement_error: Optional[str] = Field(
        None,
        max_length=20,
        description="Погрешность измерения результата в формате ±число",
    )
    unit: Optional[str] = Field(
        None, max_length=20, description="Единица измерения результата"
    )
    laboratory_activity_date: date = Field(
        ..., description="Дата проведения лабораторного исследования"
    )

    @field_validator("executor")
    @classmethod
    def validate_executor(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Необходимо указать hashMd5 исполнителя")
        v = v.strip().lower()
        if not re.fullmatch(r"[0-9a-f]{32}", v):
            raise ValueError(
                "Некорректный формат хеша исполнителя (ожидается 32-символьный hashMd5)"
            )
        return v


class CalculationCreate(CalculationBase):
    sample_id: int = Field(..., description="ID пробы")
    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: Optional[int] = Field(None, description="ID подразделения")
    research_method_id: int = Field(..., description="ID метода исследования")


class CalculationUpdate(BaseModel):
    input_data: Optional[Dict[str, Any]] = None
    equipment_data: Optional[List[int]] = None
    result: Optional[str] = None
    executor: Optional[str] = Field(None, min_length=2)
    measurement_error: Optional[str] = Field(None, max_length=20)
    unit: Optional[str] = Field(None, max_length=20)
    laboratory_activity_date: Optional[date] = None
    sample_id: Optional[int] = None
    laboratory_id: Optional[int] = None
    department_id: Optional[int] = None
    research_method_id: Optional[int] = None


class EquipmentBrief(BaseModel):
    id: int
    name: str
    serial_number: str
    verification_info: str
    verification_date: date
    verification_end_date: date
    type: str
    version: str

    class Config:
        from_attributes = True


class CalculationResponse(CalculationBase):
    id: int
    sample_id: int
    laboratory_id: int
    department_id: Optional[int] = None
    research_method_id: int
    equipment: Optional[List[EquipmentBrief]] = None
    sample: Optional[Dict[str, Any]] = None
    research_method: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


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
    stored_method_id: int = Field(
        ..., description="ID методики, зафиксированной в расчёте"
    )
    stored_method_deleted: bool = Field(
        ..., description="Удалена ли методика из расчёта в справочнике"
    )
    current_method_id: Optional[int] = Field(
        None, description="ID актуальной методики с тем же именем"
    )
    methodology_ambiguous: bool = Field(
        default=False,
        description="Несколько подходящих актуальных методик, нужен выбор пользователя",
    )
    candidate_methods: List[MethodologyChoiceCandidate] = Field(
        default_factory=list,
        description="Список актуальных методик при неоднозначном совпадении",
    )
    stored_method_group_id: Optional[int] = Field(
        None, description="ID группы методики на момент расчёта"
    )
    stored_method_group_name: Optional[str] = Field(
        None, description="Наименование группы методики на момент расчёта"
    )


class CalculateRequest(BaseModel):
    input_data: Dict[str, Any] = Field(..., description="Входные данные для расчета")
    research_method_id: int = Field(..., description="ID метода исследования")
    equipment_data: Optional[List[int]] = Field(None, description="Список ID приборов")
