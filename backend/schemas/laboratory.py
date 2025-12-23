from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class LaboratoryBase(BaseModel):
    name: str = Field(..., max_length=100, description="Аббревиатура")
    full_name: str = Field(..., max_length=255, description="Полное название")
    laboratory_location: Optional[str] = Field(
        None,
        max_length=255,
        description="Место осуществления лабораторной деятельности",
    )

    @field_validator("name", "full_name")
    @classmethod
    def strip_strings(cls, v: str) -> str:
        if v:
            v = v.strip()
            if not v:
                raise ValueError("Поле не может быть пустым")
        return v


class LaboratoryCreate(LaboratoryBase):
    pass


class LaboratoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    full_name: Optional[str] = Field(None, max_length=255)
    laboratory_location: Optional[str] = Field(None, max_length=255)

    @field_validator("name", "full_name", mode="before")
    @classmethod
    def strip_strings(cls, v: Optional[str]) -> Optional[str]:
        if v:
            v = v.strip()
            if not v:
                raise ValueError("Поле не может быть пустым")
        return v


class DepartmentBase(BaseModel):
    name: str = Field(..., max_length=100, description="Название подразделения")
    laboratory_location: str = Field(
        ..., max_length=255, description="Место осуществления лабораторной деятельности"
    )

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        if v:
            v = v.strip()
            if not v:
                raise ValueError("Название не может быть пустым")
        return v

    @field_validator("laboratory_location")
    @classmethod
    def validate_laboratory_location(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError(
                "Место осуществления лабораторной деятельности обязательно для подразделения"
            )
        return v.strip()


class DepartmentCreate(DepartmentBase):
    laboratory_id: int = Field(..., description="ID лаборатории")


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    laboratory_location: Optional[str] = Field(None, max_length=255)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v: Optional[str]) -> Optional[str]:
        if v:
            v = v.strip()
            if not v:
                raise ValueError("Название не может быть пустым")
        return v

    @field_validator("laboratory_location", mode="before")
    @classmethod
    def validate_laboratory_location(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                raise ValueError(
                    "Место осуществления лабораторной деятельности не может быть пустым"
                )
            return v.strip()
        return v


class DepartmentResponse(DepartmentBase):
    id: int
    laboratory_id: int
    laboratory_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LaboratoryResponse(LaboratoryBase):
    id: int
    departments_count: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BranchBase(BaseModel):
    name: str = Field(..., max_length=255, description="Название филиала")
    phone: Optional[str] = Field(
        None, max_length=20, description="Номер телефона филиала"
    )

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        if v:
            v = v.strip()
            if not v:
                raise ValueError("Название филиала не может быть пустым")
        return v


class BranchCreate(BranchBase):
    laboratory_id: int = Field(..., description="ID лаборатории")
    department_id: Optional[int] = Field(None, description="ID подразделения")


class BranchUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v: Optional[str]) -> Optional[str]:
        if v:
            v = v.strip()
            if not v:
                raise ValueError("Название филиала не может быть пустым")
        return v


class BranchResponse(BranchBase):
    id: int
    laboratory_id: int
    department_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SamplingLocationBase(BaseModel):
    name: str = Field(..., max_length=255, description="Название места отбора пробы")

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        if v:
            v = v.strip()
            if not v:
                raise ValueError("Название места отбора пробы не может быть пустым")
        return v


class SamplingLocationCreate(SamplingLocationBase):
    branch_id: int = Field(..., description="ID филиала")


class SamplingLocationUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v: Optional[str]) -> Optional[str]:
        if v:
            v = v.strip()
            if not v:
                raise ValueError("Название места отбора пробы не может быть пустым")
        return v


class SamplingLocationResponse(SamplingLocationBase):
    id: int
    branch_id: int
    branch_name: Optional[str] = None
    branch_phone: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WellModeBase(BaseModel):
    name: str = Field(..., max_length=255, description="Название режима скважины")

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        if v:
            v = v.strip()
            if not v:
                raise ValueError("Название режима скважины не может быть пустым")
        return v


class WellModeCreate(WellModeBase):
    branch_id: int = Field(..., description="ID филиала")


class WellModeUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v: Optional[str]) -> Optional[str]:
        if v:
            v = v.strip()
            if not v:
                raise ValueError("Название режима скважины не может быть пустым")
        return v


class WellModeResponse(WellModeBase):
    id: int
    branch_id: int
    branch_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True
