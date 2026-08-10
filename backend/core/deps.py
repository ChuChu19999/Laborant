from __future__ import annotations
from typing import Annotated
from fastapi import Depends, Query
import pendulum
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.exceptions import ForbiddenError
from core.security import get_current_user
from schemas.role import UserPermissionsResponse
from services.user_permissions import get_user_permissions_or_raise
from utils.parsers import parse_query_datetime

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[dict, Depends(get_current_user)]


async def get_user_permissions(
    db: DbSession,
    decoded_token: CurrentUser,
) -> UserPermissionsResponse:
    """Права текущего пользователя (403 если доступ закрыт)."""
    return await get_user_permissions_or_raise(db, decoded_token)


UserPermissions = Annotated[
    UserPermissionsResponse,
    Depends(get_user_permissions),
]


def require_admin(effective: UserPermissionsResponse) -> None:
    """Доступ только для admin."""
    if not effective.is_admin:
        raise ForbiddenError("Отказано в доступе")


def parse_date_range(
    date_from: str | None,
    date_to: str | None,
) -> tuple[pendulum.DateTime | None, pendulum.DateTime | None]:
    """Парсинг диапазона дат из query-параметров."""
    parsed_from = parse_query_datetime(date_from) if date_from else None
    parsed_to = parse_query_datetime(date_to) if date_to else None
    return parsed_from, parsed_to


class ScopePaginationParams:
    """Общие query-параметры списков с фильтрацией по лаборатории и поиском."""

    def __init__(
        self,
        laboratory_id: int | None = Query(None),
        department_id: int | None = Query(None),
        page: int | None = Query(None, ge=1),
        page_size: int | None = Query(None, ge=1, le=100),
        search: str | None = Query(None),
        sort_by: str | None = Query(None),
        sort_order: str | None = Query("desc"),
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

    def __init__(
        self,
        laboratory_id: int | None = Query(None),
        department_id: int | None = Query(None),
        page: int | None = Query(None, ge=1),
        page_size: int | None = Query(None, ge=1, le=100),
        sort_by: str | None = Query(None),
        sort_order: str | None = Query("desc"),
    ):
        self.laboratory_id = laboratory_id
        self.department_id = department_id
        self.page = page
        self.page_size = page_size
        self.sort_by = sort_by
        self.sort_order = sort_order


class SampleListFilters:
    """Фильтры списка и экспорта проб."""

    def __init__(
        self,
        laboratory_id: int | None = Query(None),
        department_id: int | None = Query(None),
        page: int | None = Query(None, ge=1),
        page_size: int | None = Query(None, ge=1, le=100),
        search: str | None = Query(None),
        search_sampling_location: str | None = Query(None),
        search_protocols: str | None = Query(None),
        search_added_by: str | None = Query(None),
        sample_type: str | None = Query(None),
        sample_types: list[str] | None = Query(None),
        test_object: str | None = Query(None),
        test_objects: list[str] | None = Query(None),
        sort_by: str | None = Query(None),
        sort_order: str | None = Query("desc"),
        sampling_date_from: str | None = Query(None),
        sampling_date_to: str | None = Query(None),
        receiving_date_from: str | None = Query(None),
        receiving_date_to: str | None = Query(None),
        created_at_from: str | None = Query(None),
        created_at_to: str | None = Query(None),
    ):
        self.laboratory_id = laboratory_id
        self.department_id = department_id
        self.page = page
        self.page_size = page_size
        self.search = search
        self.search_sampling_location = search_sampling_location
        self.search_protocols = search_protocols
        self.search_added_by = search_added_by
        self.sample_type = sample_type
        self.sample_types = sample_types
        self.test_object = test_object
        self.test_objects = test_objects
        self.sort_by = sort_by
        self.sort_order = sort_order
        self.sampling_date_from, self.sampling_date_to = parse_date_range(sampling_date_from, sampling_date_to)
        self.receiving_date_from, self.receiving_date_to = parse_date_range(receiving_date_from, receiving_date_to)
        self.created_at_from, self.created_at_to = parse_date_range(created_at_from, created_at_to)


class NdNormListFilters:
    """Фильтры списка норм НД."""

    def __init__(
        self,
        laboratory_id: int | None = Query(None),
        department_id: int | None = Query(None),
        page: int | None = Query(None, ge=1),
        page_size: int | None = Query(None, ge=1, le=100),
        search: str | None = Query(None),
        test_object: str | None = Query(None),
        test_objects: list[str] | None = Query(None),
        sort_by: str | None = Query(None),
        sort_order: str | None = Query("desc"),
        created_at_from: str | None = Query(None),
        created_at_to: str | None = Query(None),
    ):
        self.laboratory_id = laboratory_id
        self.department_id = department_id
        self.page = page
        self.page_size = page_size
        self.search = search
        self.test_object = test_object
        self.test_objects = test_objects
        self.sort_by = sort_by
        self.sort_order = sort_order
        self.created_at_from, self.created_at_to = parse_date_range(created_at_from, created_at_to)


class ProtocolListFilters:
    """Фильтры списка протоколов."""

    def __init__(
        self,
        laboratory_id: int | None = Query(None),
        department_id: int | None = Query(None),
        include_deleted: bool = Query(False),
        page: int | None = Query(None, ge=1),
        page_size: int | None = Query(None, ge=1, le=100),
        sort_by: str | None = Query(None),
        sort_order: str | None = Query("desc"),
        is_accredited: bool | None = Query(None),
        search: str | None = Query(None),
        search_date: str | None = Query(None),
        search_sampling_act: str | None = Query(None),
        search_samples: str | None = Query(None),
        test_protocol_date_from: str | None = Query(None),
        test_protocol_date_to: str | None = Query(None),
        created_at_from: str | None = Query(None),
        created_at_to: str | None = Query(None),
    ):
        self.laboratory_id = laboratory_id
        self.department_id = department_id
        self.include_deleted = include_deleted
        self.page = page
        self.page_size = page_size
        self.sort_by = sort_by
        self.sort_order = sort_order
        self.is_accredited = is_accredited
        self.search = search
        self.search_date = search_date
        self.search_sampling_act = search_sampling_act
        self.search_samples = search_samples
        self.test_protocol_date_from, self.test_protocol_date_to = parse_date_range(
            test_protocol_date_from, test_protocol_date_to
        )
        self.created_at_from, self.created_at_to = parse_date_range(created_at_from, created_at_to)


class EquipmentListFilters:
    """Фильтры списка оборудования."""

    def __init__(
        self,
        laboratory_id: int | None = Query(None),
        department_id: int | None = Query(None),
        equipment_type: str | None = Query(None),
        equipment_types: list[str] | None = Query(None),
        page: int | None = Query(None, ge=1),
        page_size: int | None = Query(None, ge=1, le=100),
        search: str | None = Query(None),
        sort_by: str | None = Query(None),
        sort_order: str | None = Query("desc"),
        verification_date_from: str | None = Query(None),
        verification_date_to: str | None = Query(None),
        verification_end_date_from: str | None = Query(None),
        verification_end_date_to: str | None = Query(None),
        created_at_from: str | None = Query(None),
        created_at_to: str | None = Query(None),
    ):
        self.laboratory_id = laboratory_id
        self.department_id = department_id
        self.equipment_type = equipment_type
        self.equipment_types = equipment_types
        self.page = page
        self.page_size = page_size
        self.search = search
        self.sort_by = sort_by
        self.sort_order = sort_order
        self.verification_date_from, self.verification_date_to = parse_date_range(
            verification_date_from, verification_date_to
        )
        self.verification_end_date_from, self.verification_end_date_to = parse_date_range(
            verification_end_date_from, verification_end_date_to
        )
        self.created_at_from, self.created_at_to = parse_date_range(created_at_from, created_at_to)

    @property
    def equipment_types_list(self) -> list[str] | None:
        if self.equipment_types:
            return self.equipment_types
        if self.equipment_type:
            return [self.equipment_type]
        return None
