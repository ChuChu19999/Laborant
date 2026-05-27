from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.exceptions import NotFoundError
from core.security import IsAuthenticated
from schemas.pagination import PaginatedResponse
from schemas.test_object import (
    TestObjectCreate,
    TestObjectResponse,
    TestObjectSelectItem,
    TestObjectUpdate,
    VisibilityScope,
    VisibilityScopeEntity,
)
from services.test_object import (
    create_test_object,
    delete_test_object,
    enrich_visibility_scope_labels,
    get_test_object_by_id,
    get_test_object_names,
    get_test_objects_list,
    update_test_object,
)
from utils.test_object_visibility import normalize_visibility_scope

router = APIRouter()


def _snapshot_test_object(item) -> Dict[str, Any]:
    return {
        "id": item.id,
        "name": item.name,
        "tag": item.tag,
        "visibility_scope": normalize_visibility_scope(item.visibility_scope),
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "deleted_at": item.deleted_at,
    }


def _to_response(
    item_data: Dict[str, Any], visibility_labels: Optional[dict] = None
) -> TestObjectResponse:
    scope = normalize_visibility_scope(item_data["visibility_scope"])
    laboratories = []
    departments = []
    if visibility_labels:
        laboratories = [
            VisibilityScopeEntity(**entry)
            for entry in visibility_labels.get("laboratories", [])
        ]
        departments = [
            VisibilityScopeEntity(**entry)
            for entry in visibility_labels.get("departments", [])
        ]
    return TestObjectResponse(
        id=item_data["id"],
        name=item_data["name"],
        tag=item_data["tag"],
        visibility_scope=VisibilityScope(
            laboratory_ids=scope.get("laboratory_ids", []),
            department_ids=scope.get("department_ids", []),
            laboratories=laboratories,
            departments=departments,
        ),
        created_at=item_data["created_at"],
        updated_at=item_data["updated_at"],
        deleted_at=item_data["deleted_at"],
    )


@router.get(
    "/test-objects/",
    response_model=PaginatedResponse[TestObjectResponse],
    summary="Справочник объектов испытаний",
    description=(
        "Возвращает список объектов испытаний с пагинацией. "
        "Поддерживает поиск и сортировку."
    ),
)
# @IsAuthenticated
async def list_test_objects(
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("asc"),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает справочник объектов испытаний."""
    items, total, total_pages = await get_test_objects_list(
        db,
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    response_items = []
    for item in items:
        await db.refresh(item)
        item_data = _snapshot_test_object(item)
        labels = await enrich_visibility_scope_labels(db, item_data["visibility_scope"])
        response_items.append(_to_response(item_data, labels))

    return PaginatedResponse(
        items=response_items,
        total=total,
        page=page or 1,
        page_size=page_size or total,
        total_pages=total_pages,
    )


@router.get(
    "/test-objects/select/",
    response_model=List[TestObjectSelectItem],
    summary="Объекты испытаний для селектов",
    description=(
        "Возвращает объекты испытаний с учетом области видимости. "
        "Удаленные записи не включаются."
    ),
)
# @IsAuthenticated
async def list_test_objects_for_select(
    laboratory_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает объекты испытаний для выбора в формах."""
    items, _, _ = await get_test_objects_list(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        for_select=True,
    )
    response_items: List[TestObjectSelectItem] = []
    for item in items:
        await db.refresh(item)
        response_items.append(TestObjectSelectItem(name=item.name, tag=item.tag))
    return response_items


@router.get(
    "/test-objects/names/",
    response_model=List[str],
    summary="Наименования объектов испытаний",
    description="Возвращает только наименования для фильтров и обратной совместимости.",
)
# @IsAuthenticated
async def list_test_object_names(
    laboratory_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает наименования объектов испытаний."""
    return await get_test_object_names(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
    )


@router.get(
    "/test-objects/{test_object_id}/",
    response_model=TestObjectResponse,
    summary="Объект испытаний по ID",
)
# @IsAuthenticated
async def get_test_object_endpoint(
    test_object_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Возвращает объект испытаний по ID."""
    item = await get_test_object_by_id(db, test_object_id)
    if not item:
        raise NotFoundError("Объект испытаний не найден")
    await db.refresh(item)
    item_data = _snapshot_test_object(item)
    labels = await enrich_visibility_scope_labels(db, item_data["visibility_scope"])
    return _to_response(item_data, labels)


@router.post(
    "/test-objects/",
    response_model=TestObjectResponse,
    status_code=201,
    summary="Создать объект испытаний",
)
# @IsAuthenticated
async def create_test_object_endpoint(
    data: TestObjectCreate,
    db: AsyncSession = Depends(get_db),
):
    """Создает запись в справочнике объектов испытаний."""
    item = await create_test_object(db, data)
    await db.commit()
    await db.refresh(item)
    item_data = _snapshot_test_object(item)
    labels = await enrich_visibility_scope_labels(db, item_data["visibility_scope"])
    return _to_response(item_data, labels)


@router.patch(
    "/test-objects/{test_object_id}/",
    response_model=TestObjectResponse,
    summary="Обновить объект испытаний",
)
# @IsAuthenticated
async def update_test_object_endpoint(
    test_object_id: int,
    data: TestObjectUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Обновляет запись в справочнике объектов испытаний."""
    item = await update_test_object(db, test_object_id, data)
    await db.commit()
    await db.refresh(item)
    item_data = _snapshot_test_object(item)
    labels = await enrich_visibility_scope_labels(db, item_data["visibility_scope"])
    return _to_response(item_data, labels)


@router.delete(
    "/test-objects/{test_object_id}/",
    status_code=204,
    summary="Удалить объект испытаний",
)
# @IsAuthenticated
async def delete_test_object_endpoint(
    test_object_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Мягко удаляет объект испытаний из справочника."""
    await delete_test_object(db, test_object_id)
    await db.commit()
