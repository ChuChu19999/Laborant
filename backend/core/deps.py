from __future__ import annotations
from typing import Annotated, Literal, Protocol
from fastapi import Depends, Query
import pendulum
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.exceptions import DomainValidationError, ForbiddenError
from core.security import get_current_user
from schemas.role import UserPermissionsResponse
from services.user_permissions import get_user_permissions_or_raise
from utils.monitoring_period import (
    DEFAULT_MONITORING_PERIOD,
    MONITORING_PERIOD_QUERY_PATTERN,
    MonitoringPeriodValue,
)
from utils.parsers import parse_query_datetime, parse_sample_ids

SortOrder = Literal["asc", "desc"]

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[dict, Depends(get_current_user)]


async def get_user_permissions(
    db: DbSession,
    decoded_token: CurrentUser,
) -> UserPermissionsResponse:
    """Вернуть права текущего пользователя, иначе вызвать ForbiddenError."""
    return await get_user_permissions_or_raise(db, decoded_token)


UserPermissions = Annotated[
    UserPermissionsResponse,
    Depends(get_user_permissions),
]


def require_admin(effective: UserPermissionsResponse) -> None:
    """Разрешить доступ только админу."""
    if not effective.is_admin:
        raise ForbiddenError("Отказано в доступе")


def parse_date_range(
    date_from: str | None,
    date_to: str | None,
) -> tuple[pendulum.DateTime | None, pendulum.DateTime | None]:
    """Разобрать диапазон дат из параметров запроса."""
    return parse_query_datetime(date_from), parse_query_datetime(date_to)


def _one_or_many(many: list[str] | None, one: str | None) -> list[str] | None:
    """Вернуть список значений: несколько одинаковых параметров в URL или одно поле."""
    if many:
        return many
    if one:
        return [one]
    return None


class ScopePaginationParams:
    """Общие параметры запроса списков с фильтрацией по лаборатории и поиском."""

    laboratory_id: int | None
    department_id: int | None
    page: int | None
    page_size: int | None
    search: str | None
    sort_by: str | None
    sort_order: SortOrder

    def __init__(
        self,
        laboratory_id: int | None = Query(None),
        department_id: int | None = Query(None),
        page: int | None = Query(None, ge=1),
        page_size: int | None = Query(None, ge=1, le=100),
        search: str | None = Query(None),
        sort_by: str | None = Query(None),
        sort_order: SortOrder = Query("desc"),
    ):
        self.laboratory_id = laboratory_id
        self.department_id = department_id
        self.page = page
        self.page_size = page_size
        self.search = search
        self.sort_by = sort_by
        self.sort_order = sort_order


class ScopeSortPaginationParams:
    """Scope + пагинация + сортировка без search."""

    laboratory_id: int | None
    department_id: int | None
    page: int | None
    page_size: int | None
    sort_by: str | None
    sort_order: SortOrder

    def __init__(
        self,
        laboratory_id: int | None = Query(None),
        department_id: int | None = Query(None),
        page: int | None = Query(None, ge=1),
        page_size: int | None = Query(None, ge=1, le=100),
        sort_by: str | None = Query(None),
        sort_order: SortOrder = Query("desc"),
    ):
        self.laboratory_id = laboratory_id
        self.department_id = department_id
        self.page = page
        self.page_size = page_size
        self.sort_by = sort_by
        self.sort_order = sort_order


class _ScopePaginationTarget(Protocol):
    """Поля scope, пагинации и сортировки для копирования из ScopePaginationParams."""

    laboratory_id: int | None
    department_id: int | None
    page: int | None
    page_size: int | None
    search: str | None
    sort_by: str | None
    sort_order: SortOrder


def _apply_scope_pagination(target: _ScopePaginationTarget, scope: ScopePaginationParams) -> None:
    """Скопировать общие поля ScopePaginationParams на объект фильтров."""
    target.laboratory_id = scope.laboratory_id
    target.department_id = scope.department_id
    target.page = scope.page
    target.page_size = scope.page_size
    target.search = scope.search
    target.sort_by = scope.sort_by
    target.sort_order = scope.sort_order


class SampleListFilters:
    """Фильтры списка и экспорта проб."""

    laboratory_id: int | None
    department_id: int | None
    page: int | None
    page_size: int | None
    search: str | None
    sort_by: str | None
    sort_order: SortOrder

    def __init__(
        self,
        scope: Annotated[ScopePaginationParams, Depends()],
        search_sampling_location: str | None = Query(None),
        search_protocols: str | None = Query(None),
        search_added_by: str | None = Query(None),
        sample_type: str | None = Query(None),
        sample_types: list[str] | None = Query(None),
        test_object: str | None = Query(None),
        test_objects: list[str] | None = Query(None),
        sampling_date_from: str | None = Query(None),
        sampling_date_to: str | None = Query(None),
        receiving_date_from: str | None = Query(None),
        receiving_date_to: str | None = Query(None),
        created_at_from: str | None = Query(None),
        created_at_to: str | None = Query(None),
    ):
        _apply_scope_pagination(self, scope)
        self.search_sampling_location = search_sampling_location
        self.search_protocols = search_protocols
        self.search_added_by = search_added_by
        self.sample_type = sample_type
        self.sample_types = sample_types
        self.test_object = test_object
        self.test_objects = test_objects
        self.sampling_date_from, self.sampling_date_to = parse_date_range(sampling_date_from, sampling_date_to)
        self.receiving_date_from, self.receiving_date_to = parse_date_range(receiving_date_from, receiving_date_to)
        self.created_at_from, self.created_at_to = parse_date_range(created_at_from, created_at_to)

    @property
    def sample_types_list(self) -> list[str] | None:
        """Типы проб: несколько значений в URL или одно поле sample_type."""
        return _one_or_many(self.sample_types, self.sample_type)

    @property
    def test_objects_list(self) -> list[str] | None:
        """Объекты испытаний: несколько значений в URL или одно поле test_object."""
        return _one_or_many(self.test_objects, self.test_object)


class NdNormListFilters:
    """Фильтры списка норм НД."""

    laboratory_id: int | None
    department_id: int | None
    page: int | None
    page_size: int | None
    search: str | None
    sort_by: str | None
    sort_order: SortOrder

    def __init__(
        self,
        scope: Annotated[ScopePaginationParams, Depends()],
        test_object: str | None = Query(None),
        test_objects: list[str] | None = Query(None),
        created_at_from: str | None = Query(None),
        created_at_to: str | None = Query(None),
    ):
        _apply_scope_pagination(self, scope)
        self.test_object = test_object
        self.test_objects = test_objects
        self.created_at_from, self.created_at_to = parse_date_range(created_at_from, created_at_to)

    @property
    def test_objects_list(self) -> list[str] | None:
        """Объекты испытаний: несколько значений в URL или одно поле test_object."""
        return _one_or_many(self.test_objects, self.test_object)


class ProtocolListFilters:
    """Фильтры списка протоколов."""

    laboratory_id: int | None
    department_id: int | None
    page: int | None
    page_size: int | None
    search: str | None
    sort_by: str | None
    sort_order: SortOrder

    def __init__(
        self,
        scope: Annotated[ScopePaginationParams, Depends()],
        include_deleted: bool = Query(False),
        is_accredited: bool | None = Query(None),
        search_date: str | None = Query(None),
        search_sampling_act: str | None = Query(None),
        search_samples: str | None = Query(None),
        test_protocol_date_from: str | None = Query(None),
        test_protocol_date_to: str | None = Query(None),
        created_at_from: str | None = Query(None),
        created_at_to: str | None = Query(None),
    ):
        _apply_scope_pagination(self, scope)
        self.include_deleted = include_deleted
        self.is_accredited = is_accredited
        self.search_date = search_date
        self.search_sampling_act = search_sampling_act
        self.search_samples = search_samples
        self.test_protocol_date_from, self.test_protocol_date_to = parse_date_range(
            test_protocol_date_from, test_protocol_date_to
        )
        self.created_at_from, self.created_at_to = parse_date_range(created_at_from, created_at_to)


class EquipmentListFilters:
    """Фильтры списка оборудования."""

    laboratory_id: int | None
    department_id: int | None
    page: int | None
    page_size: int | None
    search: str | None
    sort_by: str | None
    sort_order: SortOrder

    def __init__(
        self,
        scope: Annotated[ScopePaginationParams, Depends()],
        equipment_type: str | None = Query(None),
        equipment_types: list[str] | None = Query(None),
        verification_date_from: str | None = Query(None),
        verification_date_to: str | None = Query(None),
        verification_end_date_from: str | None = Query(None),
        verification_end_date_to: str | None = Query(None),
        created_at_from: str | None = Query(None),
        created_at_to: str | None = Query(None),
    ):
        _apply_scope_pagination(self, scope)
        self.equipment_type = equipment_type
        self.equipment_types = equipment_types
        self.verification_date_from, self.verification_date_to = parse_date_range(
            verification_date_from, verification_date_to
        )
        self.verification_end_date_from, self.verification_end_date_to = parse_date_range(
            verification_end_date_from, verification_end_date_to
        )
        self.created_at_from, self.created_at_to = parse_date_range(created_at_from, created_at_to)

    @property
    def equipment_types_list(self) -> list[str] | None:
        """Типы оборудования: несколько значений в URL или одно поле equipment_type."""
        return _one_or_many(self.equipment_types, self.equipment_type)


class CalculationListFilters:
    """Фильтры списка расчётов."""

    laboratory_id: int | None
    department_id: int | None
    page: int | None
    page_size: int | None
    sort_by: str | None
    sort_order: SortOrder
    sample_id: int | None
    sample_ids: list[int] | None
    research_method_id: int | None
    include_deleted: bool

    def __init__(
        self,
        scope: Annotated[ScopeSortPaginationParams, Depends()],
        sample_id: int | None = Query(None),
        sample_ids: str | None = Query(None, description="Список ID проб через запятую"),
        research_method_id: int | None = Query(None),
        include_deleted: bool = Query(False),
    ):
        self.laboratory_id = scope.laboratory_id
        self.department_id = scope.department_id
        self.page = scope.page
        self.page_size = scope.page_size
        self.sort_by = scope.sort_by
        self.sort_order = scope.sort_order
        self.sample_id = sample_id
        try:
            self.sample_ids = parse_sample_ids(sample_ids)
        except ValueError as exc:
            raise DomainValidationError(str(exc)) from exc
        self.research_method_id = research_method_id
        self.include_deleted = include_deleted


class PaginationSearchSortParams:
    """Пагинация + поиск + сортировка без scope."""

    page: int | None
    page_size: int | None
    search: str | None
    sort_by: str | None
    sort_order: SortOrder

    def __init__(
        self,
        page: int | None = Query(None, ge=1),
        page_size: int | None = Query(None, ge=1, le=100),
        search: str | None = Query(None),
        sort_by: str | None = Query(None),
        sort_order: SortOrder = Query("desc"),
    ):
        self.page = page
        self.page_size = page_size
        self.search = search
        self.sort_by = sort_by
        self.sort_order = sort_order


class _PaginationSearchSortTarget(Protocol):
    """Поля пагинации, поиска и сортировки для копирования из PaginationSearchSortParams."""

    page: int | None
    page_size: int | None
    search: str | None
    sort_by: str | None
    sort_order: SortOrder


def _apply_pagination_search_sort(
    target: _PaginationSearchSortTarget,
    params: PaginationSearchSortParams,
) -> None:
    """Скопировать поля PaginationSearchSortParams на объект фильтров."""
    target.page = params.page
    target.page_size = params.page_size
    target.search = params.search
    target.sort_by = params.sort_by
    target.sort_order = params.sort_order


class DepartmentListFilters:
    """Фильтры списка подразделений."""

    laboratory_id: int | None
    page: int | None
    page_size: int | None
    search: str | None
    sort_by: str | None
    sort_order: SortOrder

    def __init__(
        self,
        pagination: Annotated[PaginationSearchSortParams, Depends()],
        laboratory_id: int | None = Query(None),
    ):
        _apply_pagination_search_sort(self, pagination)
        self.laboratory_id = laboratory_id


class RoleListFilters:
    """Фильтры списка ролей (сортировка по умолчанию asc)."""

    page: int | None
    page_size: int | None
    search: str | None
    role_type: str | None
    sort_by: str | None
    sort_order: SortOrder

    def __init__(
        self,
        page: int | None = Query(None, ge=1),
        page_size: int | None = Query(None, ge=1, le=100),
        search: str | None = Query(None),
        role_type: str | None = Query(None),
        sort_by: str | None = Query(None),
        sort_order: SortOrder = Query("asc"),
    ):
        self.page = page
        self.page_size = page_size
        self.search = search
        self.role_type = role_type
        self.sort_by = sort_by
        self.sort_order = sort_order


class TestObjectListFilters:
    """Фильтры админ-списка объектов испытаний (сортировка по умолчанию asc)."""

    page: int | None
    page_size: int | None
    search: str | None
    sort_by: str | None
    sort_order: SortOrder

    def __init__(
        self,
        page: int | None = Query(None, ge=1),
        page_size: int | None = Query(None, ge=1, le=100),
        search: str | None = Query(None),
        sort_by: str | None = Query(None),
        sort_order: SortOrder = Query("asc"),
    ):
        self.page = page
        self.page_size = page_size
        self.search = search
        self.sort_by = sort_by
        self.sort_order = sort_order


class MassFractionListFilters:
    """Фильтры списка точек градуировочного графика."""

    research_method_id: int | None
    page: int | None
    page_size: int | None
    sort_by: str | None
    sort_order: SortOrder

    def __init__(
        self,
        research_method_id: int | None = Query(None),
        page: int | None = Query(None, ge=1),
        page_size: int | None = Query(None, ge=1, le=100),
        sort_by: str | None = Query(None),
        sort_order: SortOrder = Query("desc"),
    ):
        self.research_method_id = research_method_id
        self.page = page
        self.page_size = page_size
        self.sort_by = sort_by
        self.sort_order = sort_order


class ScopeSortIncludeDeletedFilters:
    """ScopeSortPagination + include_deleted (шаблоны протоколов и отчётов)."""

    laboratory_id: int | None
    department_id: int | None
    page: int | None
    page_size: int | None
    sort_by: str | None
    sort_order: SortOrder
    include_deleted: bool

    def __init__(
        self,
        scope: Annotated[ScopeSortPaginationParams, Depends()],
        include_deleted: bool = Query(False),
    ):
        self.laboratory_id = scope.laboratory_id
        self.department_id = scope.department_id
        self.page = scope.page
        self.page_size = scope.page_size
        self.sort_by = scope.sort_by
        self.sort_order = scope.sort_order
        self.include_deleted = include_deleted


class ResearchMethodListFilters:
    """Фильтры списка методов исследования."""

    laboratory_id: int | None
    department_id: int | None
    page: int | None
    page_size: int | None
    search: str | None
    sort_by: str | None
    sort_order: SortOrder
    rounding_type: str | None

    def __init__(
        self,
        scope: Annotated[ScopePaginationParams, Depends()],
        rounding_type: str | None = Query(None),
    ):
        _apply_scope_pagination(self, scope)
        self.rounding_type = rounding_type


class BranchListFilters:
    """Фильтры списка филиалов (без пагинации)."""

    laboratory_id: int | None
    department_id: int | None
    search: str | None
    sort_by: str | None
    sort_order: SortOrder

    def __init__(
        self,
        laboratory_id: int | None = Query(None),
        department_id: int | None = Query(None),
        search: str | None = Query(None),
        sort_by: str | None = Query(None),
        sort_order: SortOrder = Query("desc"),
    ):
        self.laboratory_id = laboratory_id
        self.department_id = department_id
        self.search = search
        self.sort_by = sort_by
        self.sort_order = sort_order


class BranchItemListFilters:
    """Фильтры списков по филиалу: места отбора / режимы скважин."""

    branch_id: int | None
    search: str | None
    sort_by: str | None
    sort_order: SortOrder

    def __init__(
        self,
        branch_id: int | None = Query(None),
        search: str | None = Query(None),
        sort_by: str | None = Query(None),
        sort_order: SortOrder = Query("desc"),
    ):
        self.branch_id = branch_id
        self.search = search
        self.sort_by = sort_by
        self.sort_order = sort_order


class RegistrationNumbersFilters:
    """Фильтры поиска регистрационных номеров проб."""

    laboratory_id: int | None
    department_id: int | None
    method_id: int | None
    search: str | None

    def __init__(
        self,
        laboratory_id: int | None = Query(None),
        department_id: int | None = Query(None),
        method_id: int | None = Query(None),
        search: str | None = Query(None),
    ):
        self.laboratory_id = laboratory_id
        self.department_id = department_id
        self.method_id = method_id
        self.search = search


class TestObjectSelectFilters:
    """Фильтры селекта/имён объектов испытаний по области видимости."""

    laboratory_id: int | None
    department_id: int | None

    def __init__(
        self,
        laboratory_id: int | None = Query(None),
        department_id: int | None = Query(None),
    ):
        self.laboratory_id = laboratory_id
        self.department_id = department_id


class MonitoringErrorListFilters:
    """Фильтры списка ошибок мониторинга."""

    page: int | None
    page_size: int | None
    severity: str | None
    source: str | None
    resolved: bool | None
    search: str | None
    occurrence_count: int | None
    app_version: str | None
    last_seen_at_from: pendulum.DateTime | None
    last_seen_at_to: pendulum.DateTime | None
    period: MonitoringPeriodValue
    sort_by: str | None
    sort_order: SortOrder | None

    def __init__(
        self,
        page: int | None = Query(None, ge=1),
        page_size: int | None = Query(None, ge=1, le=200),
        severity: str | None = Query(None, pattern="^(warning|error|critical)$"),
        source: str | None = Query(None, pattern="^(backend|frontend)$"),
        resolved: bool | None = Query(None),
        search: str | None = Query(None, max_length=200),
        occurrence_count: int | None = Query(None, ge=1),
        app_version: str | None = Query(None, max_length=40),
        last_seen_at_from: str | None = Query(None),
        last_seen_at_to: str | None = Query(None),
        period: MonitoringPeriodValue = Query(DEFAULT_MONITORING_PERIOD, pattern=MONITORING_PERIOD_QUERY_PATTERN),
        sort_by: str | None = Query(None),
        sort_order: SortOrder | None = Query(None),
    ):
        self.page = page
        self.page_size = page_size
        self.severity = severity
        self.source = source
        self.resolved = resolved
        self.search = search
        self.occurrence_count = occurrence_count
        self.app_version = app_version
        self.last_seen_at_from, self.last_seen_at_to = parse_date_range(last_seen_at_from, last_seen_at_to)
        self.period = period
        self.sort_by = sort_by
        self.sort_order = sort_order


class MonitoringOverviewPeriod:
    """Период сводки мониторинга."""

    period: MonitoringPeriodValue

    def __init__(
        self,
        period: MonitoringPeriodValue = Query(DEFAULT_MONITORING_PERIOD, pattern=MONITORING_PERIOD_QUERY_PATTERN),
    ):
        self.period = period


ScopePaginationDep = Annotated[ScopePaginationParams, Depends()]
ScopeSortPaginationDep = Annotated[ScopeSortPaginationParams, Depends()]
PaginationSearchSortDep = Annotated[PaginationSearchSortParams, Depends()]
SampleListFiltersDep = Annotated[SampleListFilters, Depends()]
NdNormListFiltersDep = Annotated[NdNormListFilters, Depends()]
ProtocolListFiltersDep = Annotated[ProtocolListFilters, Depends()]
EquipmentListFiltersDep = Annotated[EquipmentListFilters, Depends()]
CalculationListFiltersDep = Annotated[CalculationListFilters, Depends()]
DepartmentListFiltersDep = Annotated[DepartmentListFilters, Depends()]
RoleListFiltersDep = Annotated[RoleListFilters, Depends()]
TestObjectListFiltersDep = Annotated[TestObjectListFilters, Depends()]
MassFractionListFiltersDep = Annotated[MassFractionListFilters, Depends()]
ScopeSortIncludeDeletedFiltersDep = Annotated[ScopeSortIncludeDeletedFilters, Depends()]
ResearchMethodListFiltersDep = Annotated[ResearchMethodListFilters, Depends()]
BranchListFiltersDep = Annotated[BranchListFilters, Depends()]
BranchItemListFiltersDep = Annotated[BranchItemListFilters, Depends()]
RegistrationNumbersFiltersDep = Annotated[RegistrationNumbersFilters, Depends()]
TestObjectSelectFiltersDep = Annotated[TestObjectSelectFilters, Depends()]
MonitoringErrorListFiltersDep = Annotated[MonitoringErrorListFilters, Depends()]
MonitoringOverviewPeriodDep = Annotated[MonitoringOverviewPeriod, Depends()]
