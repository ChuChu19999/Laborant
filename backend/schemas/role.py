from __future__ import annotations
from datetime import datetime
from typing import Annotated, Any, Literal
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
    SAMPLE_OPTIONAL_FIELDS,
    default_role_permissions,
    normalize_permissions,
)
from utils.role_scopes import normalize_role_scopes

_validate_role_type = make_enum_validator(RoleType, "Тип роли")
RoleTypeField = Annotated[str, AfterValidator(_validate_role_type)]
SamplingTerminologyValue = Literal["well_mode", "sampling_point"]


class NavigationPermissions(BaseModel):
    home: bool = True
    samples: bool = False
    protocols: bool = False
    equipment: bool = False
    sampling_locations: bool = False
    nd_norms: bool = False
    refraction_tables: bool = False
    test_objects: bool = False


class LaboratoryManagementPermissions(BaseModel):
    access: bool = False


class SamplesPermissions(BaseModel):
    visible_fields: list[str] = Field(default_factory=list)
    update: bool = False
    delete: bool = False

    @field_validator("visible_fields", mode="after")
    @classmethod
    def validate_visible_fields(cls, value: list[str]) -> list[str]:
        return [field for field in value if field in SAMPLE_OPTIONAL_FIELDS]


class CrudPermissions(BaseModel):
    read: bool = False
    create: bool = False
    update: bool = False
    delete: bool = False


class CalculationsPermissions(BaseModel):
    execute: bool = False
    create: bool = False
    update: bool = False
    delete: bool = False
    show_equipment: bool = False


class RolePermissions(BaseModel):
    navigation: NavigationPermissions = Field(default_factory=NavigationPermissions)
    laboratory_management: LaboratoryManagementPermissions = Field(default_factory=LaboratoryManagementPermissions)
    samples: SamplesPermissions = Field(default_factory=SamplesPermissions)
    protocols: CrudPermissions = Field(default_factory=CrudPermissions)
    equipment: CrudPermissions = Field(default_factory=CrudPermissions)
    sampling_locations: CrudPermissions = Field(default_factory=CrudPermissions)
    nd_norms: CrudPermissions = Field(default_factory=CrudPermissions)
    refraction_tables: CrudPermissions = Field(default_factory=CrudPermissions)
    test_objects: CrudPermissions = Field(default_factory=CrudPermissions)
    calculations: CalculationsPermissions = Field(default_factory=CalculationsPermissions)
    sampling_terminology: SamplingTerminologyValue = "well_mode"

    @classmethod
    def default(cls) -> RolePermissions:
        return cls.model_validate(default_role_permissions())


def permissions_to_dict(
    permissions: RolePermissions | dict[str, Any] | None,
) -> dict[str, Any]:
    """Сериализация permissions в dict для БД."""
    if permissions is None:
        return default_role_permissions()
    if isinstance(permissions, RolePermissions):
        return normalize_permissions(permissions.model_dump())
    return normalize_permissions(permissions)


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
    """Входная привязка без подписей."""

    laboratory_id: int = Field(..., gt=0)
    department_id: int | None = Field(default=None, gt=0)
    permissions: RolePermissions = Field(default_factory=RolePermissions.default)


def scopes_to_storage(
    scopes: list[RoleScopeBindingInput] | list[RoleScopeBinding],
) -> list[dict[str, Any]]:
    """Сериализация привязок для сохранения в БД."""
    raw = [
        {
            "laboratory_id": item.laboratory_id,
            "department_id": item.department_id,
            "permissions": permissions_to_dict(item.permissions),
        }
        for item in scopes
    ]
    return normalize_role_scopes(raw)


class RoleBase(BaseModel):
    name: Annotated[NonEmptyStr, Field(max_length=255)] = Field(..., description="Наименование роли")
    role_type: RoleTypeField = Field(..., description="Тип роли: laborant, engineer")
    scopes: list[RoleScopeBindingInput] = Field(
        default_factory=list,
        description="Привязки прав к лабораториям и подразделениям",
    )


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    name: Annotated[OptionalNonEmptyStr, Field(max_length=255)] = None
    role_type: RoleTypeField | None = None
    scopes: list[RoleScopeBindingInput] | None = None


class RoleResponse(BaseModel):
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
    "permissions_to_dict",
    "scopes_to_storage",
]
