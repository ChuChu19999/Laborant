from __future__ import annotations
import pendulum
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import DomainValidationError, NotFoundError
from models.nd_norm import NdNorm
from repositories import nd_norm as nd_norm_repo, research as research_repo
from repositories.base import flush_entity
from schemas.nd_norm import (
    NdNormCreate,
    NdNormMethodDataItem,
    NdNormUpdate,
)
from services.test_object import get_test_object_names
from services.visibility import validate_lab_and_department


def _normalize_method_data(
    method_data: list[NdNormMethodDataItem] | None,
) -> list[dict]:
    """Привести method_data нормы НД к списку словарей."""
    if not method_data:
        return []
    return [{"method_id": item.method_id, "value": item.value} for item in method_data]


async def _validate_test_object(
    db: AsyncSession,
    test_object: str,
    laboratory_id: int,
    department_id: int | None,
) -> None:
    """Проверить, что объект испытаний есть в справочнике области."""
    names = await get_test_object_names(db, laboratory_id, department_id)
    normalized = test_object.strip().lower()
    if not any(name.lower() == normalized for name in names):
        raise DomainValidationError("Объект испытаний не найден в справочнике")


async def _validate_method_data(
    db: AsyncSession,
    method_data: list[NdNormMethodDataItem],
    laboratory_id: int,
    department_id: int | None,
) -> None:
    """Проверить, что method_id в method_data существуют в области."""
    if not method_data:
        return

    method_ids = {item.method_id for item in method_data}
    found_ids = await research_repo.get_valid_method_ids(db, method_ids, laboratory_id, department_id)
    missing_ids = method_ids - found_ids
    if missing_ids:
        raise DomainValidationError(
            f"Некорректные методы исследования: {', '.join(str(method_id) for method_id in sorted(missing_ids))}"
        )


async def get_nd_norm_by_id(
    db: AsyncSession,
    nd_norm_id: int,
    include_deleted: bool = False,
) -> NdNorm | None:
    """Получить норму НД по ID."""
    return await nd_norm_repo.get_nd_norm_by_id(db, nd_norm_id, include_deleted)


async def require_nd_norm_by_id(
    db: AsyncSession,
    nd_norm_id: int,
    include_deleted: bool = False,
) -> NdNorm:
    """Вернуть норму НД по ID, иначе вызвать NotFoundError."""
    nd_norm = await get_nd_norm_by_id(db, nd_norm_id, include_deleted)
    if not nd_norm:
        raise NotFoundError("Норма НД не найдена")
    return nd_norm


async def get_nd_norms(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    page: int | None = None,
    page_size: int | None = None,
    search: str | None = None,
    test_object: str | None = None,
    test_objects: list[str] | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
    created_at_from: pendulum.DateTime | None = None,
    created_at_to: pendulum.DateTime | None = None,
) -> tuple[list[NdNorm], int]:
    """Получить список норм НД."""
    return await nd_norm_repo.get_nd_norms(
        db,
        laboratory_id,
        department_id,
        page,
        page_size,
        search,
        test_object,
        test_objects,
        sort_by,
        sort_order,
        created_at_from,
        created_at_to,
    )


async def create_nd_norm(db: AsyncSession, data: NdNormCreate) -> NdNorm:
    """Создать норму НД."""
    await validate_lab_and_department(db, data.laboratory_id, data.department_id)
    await _validate_test_object(db, data.test_object, data.laboratory_id, data.department_id)
    await _validate_method_data(db, data.method_data, data.laboratory_id, data.department_id)

    nd_norm = NdNorm(
        name=data.name,
        test_object=data.test_object,
        laboratory_id=data.laboratory_id,
        department_id=data.department_id,
        method_data=_normalize_method_data(data.method_data),
    )
    nd_norm = await nd_norm_repo.add_nd_norm(db, nd_norm)

    return await require_nd_norm_by_id(db, nd_norm.id)


async def update_nd_norm(
    db: AsyncSession,
    nd_norm: NdNorm,
    data: NdNormUpdate,
) -> NdNorm:
    """Обновить норму НД."""
    update_data = data.model_dump(exclude_unset=True)
    laboratory_id = update_data.get("laboratory_id", nd_norm.laboratory_id)
    department_id = update_data.get("department_id", nd_norm.department_id)
    scope_changed = "laboratory_id" in update_data or "department_id" in update_data

    if scope_changed:
        await validate_lab_and_department(db, laboratory_id, department_id)

    if "method_data" in update_data and update_data["method_data"] is not None:
        method_items = [NdNormMethodDataItem(**item) for item in update_data["method_data"]]
        await _validate_method_data(db, method_items, laboratory_id, department_id)
        nd_norm.method_data = _normalize_method_data(method_items)

    if "test_object" in update_data and update_data["test_object"] is not None:
        await _validate_test_object(db, update_data["test_object"], laboratory_id, department_id)
        nd_norm.test_object = update_data["test_object"]

    if "name" in update_data and update_data["name"] is not None:
        nd_norm.name = update_data["name"]
    if "laboratory_id" in update_data and update_data["laboratory_id"] is not None:
        nd_norm.laboratory_id = update_data["laboratory_id"]
    if "department_id" in update_data:
        nd_norm.department_id = update_data["department_id"]

    await flush_entity(db)
    return await require_nd_norm_by_id(db, nd_norm.id)


async def delete_nd_norm(db: AsyncSession, nd_norm: NdNorm) -> None:
    """Мягко удалить норму НД."""
    nd_norm.soft_delete()
    await flush_entity(db)


def resolve_nd_norm_update_scope(nd_norm: NdNorm, data: NdNormUpdate) -> tuple[int, int | None]:
    """Определить область доступа после PATCH нормы НД."""
    fields_set = data.model_fields_set
    laboratory_id = (
        data.laboratory_id
        if "laboratory_id" in fields_set and data.laboratory_id is not None
        else nd_norm.laboratory_id
    )
    department_id = data.department_id if "department_id" in fields_set else nd_norm.department_id
    return (laboratory_id, department_id)
