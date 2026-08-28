from __future__ import annotations
from pydantic import BaseModel, ConfigDict, Field, RootModel
from schemas.common import ExecutorHsnils


class EmployeeResponse(BaseModel):
    """Сотрудник из HR API: известные поля типизированы, остальные сохраняются как есть."""

    model_config = ConfigDict(
        extra="allow",
        populate_by_name=True,
        serialize_by_alias=True,
    )

    hsnils: str | None = Field(None, description="Идентификатор сотрудника в приложении")
    full_name: str | None = Field(None, alias="fullName", description="ФИО")


class EmployeesByHsnilsRequest(BaseModel):
    """Запрос данных сотрудников по списку hsnils."""

    model_config = ConfigDict(populate_by_name=True)

    hsnils: list[ExecutorHsnils] = Field(..., min_length=1, description="Список hsnils сотрудников")
    include_photo: bool = Field(False, alias="includePhoto", description="Включать фото в ответ")


class EmployeesByHsnilsResponse(RootModel[dict[str, EmployeeResponse]]):
    """Ответ с данными сотрудников по hsnils."""
