from __future__ import annotations
from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field, computed_field
from schemas.common import (
    OilMassFractionCValue,
    OilMassFractionNValue,
    OptionalOilMassFractionCValue,
    OptionalOilMassFractionNValue,
    related_entity_name,
)


class MassFractionOilRefractionTableBase(BaseModel):
    """Общие поля точки градуировочного графика массовой доли нефти."""

    c_value: OilMassFractionCValue = Field(..., description="Массовая доля нефти (C) в процентах")
    n_value: OilMassFractionNValue = Field(..., description="Показатель преломления (n)")


class MassFractionOilRefractionTableCreate(MassFractionOilRefractionTableBase):
    """Запрос на создание точки градуировочного графика."""

    research_method_id: int = Field(..., description="ID метода исследования")


class MassFractionOilRefractionTableUpdate(BaseModel):
    """Частичное обновление точки градуировочного графика."""

    c_value: OptionalOilMassFractionCValue = None
    n_value: OptionalOilMassFractionNValue = None


class MassFractionOilRefractionTableResponse(MassFractionOilRefractionTableBase):
    """Ответ API с точкой градуировочного графика массовой доли нефти."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    research_method_id: int
    research_method: Any = Field(default=None, exclude=True)
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    @computed_field
    @property
    def research_method_name(self) -> str | None:
        return related_entity_name(self.research_method)


class MassFractionOilRefractionTableBulkEntry(BaseModel):
    """Точка градуировочного графика в пакетном обновлении."""

    c_value: OilMassFractionCValue = Field(..., description="Массовая доля нефти (C) в процентах")
    n_value: OilMassFractionNValue = Field(..., description="Показатель преломления (n)")


class MassFractionOilRefractionTableBulkUpdate(BaseModel):
    """Пакетная замена точек градуировочного графика метода."""

    research_method_id: int = Field(..., description="ID метода исследования")
    entries: list[MassFractionOilRefractionTableBulkEntry] = Field(
        ...,
        description="Список точек градуировочного графика с полями c_value и n_value",
    )


class MassFractionOilRefractionTableBulkUpdateResponse(BaseModel):
    """Результат массового обновления градуировочного графика."""

    message: str = Field(..., description="Текстовый статус операции")
    created: int | None = Field(default=None, description="Число созданных точек")
    deactivated: int | None = Field(default=None, description="Число деактивированных точек")
