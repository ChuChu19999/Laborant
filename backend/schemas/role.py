from __future__ import annotations
from datetime import datetime
from typing import Annotated
from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)
from models.role import RoleType
from schemas.common import NonEmptyStr, OptionalNonEmptyStr, make_enum_validator
from schemas.visibility import VisibilityScope
from utils.permissions_constants import (
    PROTOCOL_OPTIONAL_FIELDS,
    SAMPLE_OPTIONAL_FIELDS,
    SAMPLING_LOCATION_OPTIONAL_FIELDS,
    SamplingTerminology,
    default_role_permissions,
)

_validate_role_type = make_enum_validator(RoleType, "Тип роли")
RoleTypeField = Annotated[str, AfterValidator(_validate_role_type)]


class NavigationPermissions(BaseModel):
    """Права доступа к разделам навигации."""

    home: bool = True
    samples: bool = False
    protocols: bool = False
    equipment: bool = False
    sampling_locations: bool = False
    sample_types: bool = False
    test_purposes: bool = False
    nd_norms: bool = False
    refraction_tables: bool = False
    test_objects: bool = False


class LaboratoryManagementPermissions(BaseModel):
    """Права доступа к управлению лабораторией."""

    access: bool = False


class SamplesPermissions(BaseModel):
    """Права на просмотр и изменение проб."""

    visible_fields: list[str] = Field(default_factory=list)
    update: bool = False
    delete: bool = False

    @field_validator("visible_fields", mode="after")
    @classmethod
    def validate_visible_fields(cls, value: list[str]) -> list[str]:
        return [field for field in value if field in SAMPLE_OPTIONAL_FIELDS]


class CrudPermissions(BaseModel):
    """Права на создание, чтение, изменение и удаление."""

    read: bool = False
    create: bool = False
    update: bool = False
    delete: bool = False


class ProtocolsPermissions(CrudPermissions):
    """Права на протоколы и опциональные поля формы протокола."""

    visible_fields: list[str] = Field(default_factory=list)

    @field_validator("visible_fields", mode="after")
    @classmethod
    def validate_visible_fields(cls, value: list[str]) -> list[str]:
        return [field for field in value if field in PROTOCOL_OPTIONAL_FIELDS]


class SamplingLocationsPermissions(CrudPermissions):
    """Права на места отбора проб и поля формы филиала."""

    visible_fields: list[str] = Field(default_factory=list)

    @field_validator("visible_fields", mode="after")
    @classmethod
    def validate_visible_fields(cls, value: list[str]) -> list[str]:
        return [field for field in value if field in SAMPLING_LOCATION_OPTIONAL_FIELDS]


class CalculationsPermissions(BaseModel):
    """Права на выполнение и управление расчётами."""

    execute: bool = False
    create: bool = False
    update: bool = False
    delete: bool = False
    show_equipment: bool = False


class RolePermissions(BaseModel):
    """Матрица прав роли пользователя."""

    navigation: NavigationPermissions = Field(default_factory=NavigationPermissions)
    laboratory_management: LaboratoryManagementPermissions = Field(default_factory=LaboratoryManagementPermissions)
    samples: SamplesPermissions = Field(default_factory=SamplesPermissions)
    protocols: ProtocolsPermissions = Field(default_factory=ProtocolsPermissions)
    equipment: CrudPermissions = Field(default_factory=CrudPermissions)
    sampling_locations: SamplingLocationsPermissions = Field(default_factory=SamplingLocationsPermissions)
    sample_types: CrudPermissions = Field(default_factory=CrudPermissions)
    test_purposes: CrudPermissions = Field(default_factory=CrudPermissions)
    nd_norms: CrudPermissions = Field(default_factory=CrudPermissions)
    refraction_tables: CrudPermissions = Field(default_factory=CrudPermissions)
    test_objects: CrudPermissions = Field(default_factory=CrudPermissions)
    calculations: CalculationsPermissions = Field(default_factory=CalculationsPermissions)
    sampling_terminology: SamplingTerminology = "well_mode"

    @classmethod
    def default(cls) -> RolePermissions:
        return cls.model_validate(default_role_permissions())


class RoleScopeBinding(BaseModel):
    """Привязка прав роли к лаборатории или подразделению."""

    laboratory_id: int = Field(..., gt=0, description="ID лаборатории")
    department_id: int | None = Field(
        default=None,
        gt=0,
        description="ID подразделения; null — вся лаборатория",
    )
    permissions: RolePermissions = Field(
        default_factory=RolePermissions.default,
        description="Матрица прав для этой области",
    )
    laboratory_name: str | None = Field(
        default=None,
        description="Название лаборатории для отображения",
    )
    department_name: str | None = Field(
        default=None,
        description="Название подразделения для отображения",
    )


class RoleScopeBindingInput(BaseModel):
    """Привязка прав роли к лаборатории или подразделению на входе (только id)."""

    laboratory_id: int = Field(..., gt=0)
    department_id: int | None = Field(default=None, gt=0)
    permissions: RolePermissions = Field(default_factory=RolePermissions.default)


class RoleBase(BaseModel):
    """Общие поля роли пользователя."""

    name: Annotated[NonEmptyStr, Field(max_length=255)] = Field(..., description="Наименование роли")
    role_type: RoleTypeField = Field(..., description="Тип роли: laborant, engineer")
    scopes: list[RoleScopeBindingInput] = Field(
        default_factory=list,
        description="Привязки прав к лабораториям и подразделениям",
    )


class RoleCreate(RoleBase):
    """Запрос на создание роли пользователя."""


class RoleUpdate(BaseModel):
    """Частичное обновление роли пользователя."""

    name: OptionalNonEmptyStr = Field(None, max_length=255)
    role_type: RoleTypeField | None = None
    scopes: list[RoleScopeBindingInput] | None = None


class RoleResponse(BaseModel):
    """Ответ API с данными роли пользователя."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    role_type: str
    scopes: list[RoleScopeBinding] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class UserPermissionsResponse(BaseModel):
    """Права текущего пользователя после объединения ролей из токена."""

    access_granted: bool
    is_admin: bool
    role_names: list[str] = Field(default_factory=list)
    role_types: list[str] = Field(default_factory=list)
    scopes: list[RoleScopeBinding] = Field(
        default_factory=list,
        description="Привязки прав по лабораториям и подразделениям",
    )
    permissions: RolePermissions = Field(
        default_factory=RolePermissions.default,
        description="Объединённые права по всем привязкам (для навигации без контекста)",
    )
    visibility_scope: VisibilityScope = Field(
        default_factory=VisibilityScope,
        description="Область видимости: пустой список = нет доступа (кроме admin)",
    )


__all__ = [
    "RoleBase",
    "RoleCreate",
    "RolePermissions",
    "RoleResponse",
    "RoleScopeBinding",
    "RoleScopeBindingInput",
    "RoleTypeField",
    "RoleUpdate",
    "UserPermissionsResponse",
]
