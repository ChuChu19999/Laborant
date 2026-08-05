from __future__ import annotations
from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field, field_validator
from schemas.common import (
    OilMassFractionCValue,
    OilMassFractionNValue,
    OptionalOilMassFractionCValue,
    OptionalOilMassFractionNValue,
    validate_oil_mass_fraction_c_value,
    validate_oil_mass_fraction_n_value,
)


class MassFractionOilRefractionTableBase(BaseModel):
    c_value: OilMassFractionCValue = Field(
        ..., description="Массовая доля нефти (C) в процентах"
    )
    n_value: OilMassFractionNValue = Field(
        ..., description="Показатель преломления (n)"
    )


class MassFractionOilRefractionTableCreate(MassFractionOilRefractionTableBase):
    research_method_id: int = Field(..., description="ID метода исследования")


class MassFractionOilRefractionTableUpdate(BaseModel):
    c_value: OptionalOilMassFractionCValue = None
    n_value: OptionalOilMassFractionNValue = None


class MassFractionOilRefractionTableResponse(MassFractionOilRefractionTableBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    research_method_id: int
    research_method_name: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class MassFractionOilRefractionTableBulkUpdate(BaseModel):
    research_method_id: int = Field(..., description="ID метода исследования")
    entries: list[dict[str, Any]] = Field(
        ...,
        description="Список точек градуировочного графика с полями c_value и n_value",
    )

    @field_validator("entries")
    @classmethod
    def validate_entries(cls, value: list[dict[str, Any]]) -> list[dict[str, Any]]:
        validated: list[dict[str, Any]] = []
        for entry in value:
            if "c_value" not in entry or "n_value" not in entry:
                raise ValueError("Каждая запись должна содержать c_value и n_value")
            validated.append(
                {
                    **entry,
                    "c_value": validate_oil_mass_fraction_c_value(
                        str(entry["c_value"])
                    ),
                    "n_value": validate_oil_mass_fraction_n_value(
                        str(entry["n_value"])
                    ),
                }
            )
        return validated
