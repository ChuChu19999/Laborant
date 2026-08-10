from __future__ import annotations
from datetime import datetime
from typing import Annotated
from pydantic import BaseModel, ConfigDict, Field
from schemas.common import NonEmptyStr, OptionalNonEmptyStr

LaboratoryName = Annotated[NonEmptyStr, Field(max_length=100)]
LaboratoryFullName = Annotated[NonEmptyStr, Field(max_length=255)]
DepartmentName = Annotated[NonEmptyStr, Field(max_length=100)]
DepartmentLocation = Annotated[NonEmptyStr, Field(max_length=255)]
BranchName = Annotated[NonEmptyStr, Field(max_length=255)]
SamplingLocationName = Annotated[NonEmptyStr, Field(max_length=255)]
WellModeName = Annotated[NonEmptyStr, Field(max_length=255)]


class LaboratoryBase(BaseModel):
    name: LaboratoryName = Field(..., description="Аббревиатура")
    full_name: LaboratoryFullName = Field(..., description="Полное название")
    laboratory_location: str | None = Field(
        None,
        max_length=255,
        description="Место осуществления лабораторной деятельности",
    )


class LaboratoryCreate(LaboratoryBase):
    pass


class LaboratoryUpdate(BaseModel):
    name: Annotated[OptionalNonEmptyStr, Field(max_length=100)] = None
    full_name: Annotated[OptionalNonEmptyStr, Field(max_length=255)] = None
    laboratory_location: str | None = Field(None, max_length=255)


class DepartmentBase(BaseModel):
    name: DepartmentName = Field(..., description="Название подразделения")
    laboratory_location: DepartmentLocation = Field(..., description="Место осуществления лабораторной деятельности")


class DepartmentCreate(DepartmentBase):
    laboratory_id: int = Field(..., description="ID лаборатории")


class DepartmentUpdate(BaseModel):
    name: Annotated[OptionalNonEmptyStr, Field(max_length=100)] = None
    laboratory_location: Annotated[OptionalNonEmptyStr, Field(max_length=255)] = None


class DepartmentResponse(DepartmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    laboratory_id: int
    laboratory_name: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class LaboratoryResponse(LaboratoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    departments_count: int | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class BranchBase(BaseModel):
    name: BranchName = Field(..., description="Название филиала")
    phone: str | None = Field(None, max_length=20, description="Номер телефона филиала")


class BranchCreate(BranchBase):
    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: int | None = Field(None, description="ID подразделения")


class BranchUpdate(BaseModel):
    name: Annotated[OptionalNonEmptyStr, Field(max_length=255)] = None
    phone: str | None = Field(None, max_length=20)


class BranchResponse(BranchBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    laboratory_id: int
    department_id: int | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class SamplingLocationBase(BaseModel):
    name: SamplingLocationName = Field(..., description="Название места отбора пробы")


class SamplingLocationCreate(SamplingLocationBase):
    branch_id: int = Field(..., description="ID филиала")


class SamplingLocationUpdate(BaseModel):
    name: Annotated[OptionalNonEmptyStr, Field(max_length=255)] = None


class SamplingLocationResponse(SamplingLocationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    branch_id: int
    branch_name: str | None = None
    branch_phone: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class WellModeBase(BaseModel):
    name: WellModeName = Field(..., description="Название режима скважины")


class WellModeCreate(WellModeBase):
    branch_id: int = Field(..., description="ID филиала")


class WellModeUpdate(BaseModel):
    name: Annotated[OptionalNonEmptyStr, Field(max_length=255)] = None


class WellModeResponse(WellModeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    branch_id: int
    branch_name: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
