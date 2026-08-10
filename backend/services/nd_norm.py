from __future__ import annotations
import pendulum
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import NotFoundError, ValidationError
from models.nd_norm import NdNorm
from repositories import nd_norm as nd_norm_repo
from repositories.base import flush_entity
from schemas.nd_norm import (
    NdNormCreate,
    NdNormMethodDataItem,
    NdNormResponse,
    NdNormUpdate,
)
from services.test_object import get_test_object_names
from services.visibility import validate_lab_and_department
from utils.pagination import calculate_total_pages


def _normalize_method_data(
    method_data: list[NdNormMethodDataItem] | None,
) -> list[dict]:
    if not method_data:
        return []
    return [{"method_id": item.method_id, "value": item.value} for item in method_data]


async def _validate_test_object(
    db: AsyncSession,
    test_object: str,
    laboratory_id: int,
    department_id: int | None,
) -> None:
    names = await get_test_object_names(db, laboratory_id, department_id)
    normalized = test_object.strip().lower()
    if not any(name.lower() == normalized for name in names):
        raise ValidationError("Объект испытаний не найден в справочнике")


async def _validate_method_data(
    db: AsyncSession,
    method_data: list[NdNormMethodDataItem],
    laboratory_id: int,
    department_id: int | None,
) -> None:
    if not method_data:
        return

    method_ids = {item.method_id for item in method_data}
    found_ids = await nd_norm_repo.get_valid_method_ids(db, method_ids, laboratory_id, department_id)
    missing_ids = method_ids - found_ids
    if missing_ids:
        raise ValidationError(
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
    """Получить норму НД по ID или вернуть 404."""
    nd_norm = await get_nd_norm_by_id(db, nd_norm_id, include_deleted)
    if not nd_norm:
        raise NotFoundError("Норма НД не найдена")
    return nd_norm


def build_nd_norm_response(nd_norm: NdNorm) -> NdNormResponse:
    """Собрать ответ API по норме НД с наименованиями связей."""
    response_data = NdNormResponse.model_validate(nd_norm).model_dump()
    if nd_norm.laboratory:
        response_data["laboratory_name"] = nd_norm.laboratory.name
    if nd_norm.department:
        response_data["department_name"] = nd_norm.department.name
    return NdNormResponse(**response_data)


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
) -> tuple[list[NdNorm], int, int]:
    """Получить список норм НД."""
    items, total = await nd_norm_repo.get_nd_norms(
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

    if page is not None and page_size is not None:
        total_pages = calculate_total_pages(total, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    return items, total, total_pages


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

    result = await get_nd_norm_by_id(db, nd_norm.id)
    assert result is not None
    return result


async def update_nd_norm(
    db: AsyncSession,
    nd_norm_id: int,
    data: NdNormUpdate,
) -> NdNorm:
    """Обновить норму НД."""
    nd_norm = await get_nd_norm_by_id(db, nd_norm_id)
    if not nd_norm:
        raise NotFoundError("Норма НД не найдена")

    update_data = data.model_dump(exclude_unset=True)
    laboratory_id = update_data.get("laboratory_id", nd_norm.laboratory_id)
    department_id = update_data.get("department_id", nd_norm.department_id)

    if "laboratory_id" in update_data or "department_id" in update_data:
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
    result = await get_nd_norm_by_id(db, nd_norm.id)
    assert result is not None
    return result


async def delete_nd_norm(db: AsyncSession, nd_norm_id: int) -> None:
    """Мягко удалить норму НД."""
    nd_norm = await get_nd_norm_by_id(db, nd_norm_id)
    if not nd_norm:
        raise NotFoundError("Норма НД не найдена")
    nd_norm.soft_delete()
    await flush_entity(db)
