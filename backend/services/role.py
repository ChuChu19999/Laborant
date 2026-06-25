from typing import List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import ConflictError, NotFoundError
from models.role import Role
from schemas.role import RoleCreate, RoleUpdate, visibility_scope_to_dict
from services.test_object import enrich_visibility_scope_labels
from utils.pagination import calculate_total_pages
from utils.sorting import build_order_by
from utils.test_object_visibility import normalize_visibility_scope


def _serialize_role(item: Role) -> Role:
    item.visibility_scope = normalize_visibility_scope(item.visibility_scope)
    return item


async def get_role_by_id(
    db: AsyncSession,
    role_id: int,
    include_deleted: bool = False,
) -> Optional[Role]:
    """Получить роль по ID."""
    query = select(Role).where(Role.id == role_id)
    if not include_deleted:
        query = query.where(Role.deleted_at.is_(None))
    result = await db.execute(query)
    item = result.scalar_one_or_none()
    if item:
        return _serialize_role(item)
    return None


async def get_roles_list(
    db: AsyncSession,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    search: Optional[str] = None,
    role_type: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> Tuple[List[Role], int, int]:
    """Получить список ролей из справочника."""
    query = select(Role).where(Role.deleted_at.is_(None))

    if search:
        query = query.where(Role.name.ilike(f"%{search}%"))

    if role_type:
        query = query.where(Role.role_type == role_type)

    sort_mapping = {
        "name": Role.name,
        "role_type": Role.role_type,
        "created_at": Role.created_at,
        "updated_at": Role.updated_at,
    }
    order_by = build_order_by(
        sort_by,
        sort_order,
        sort_mapping,
        Role.id,
        default_order="asc",
    )
    query = query.order_by(order_by)

    result = await db.execute(query)
    items = [_serialize_role(item) for item in result.scalars().all()]
    total = len(items)

    if page is not None and page_size is not None:
        offset = (page - 1) * page_size
        items = items[offset : offset + page_size]

    if page_size:
        total_pages = calculate_total_pages(total, page_size)
    else:
        total_pages = 1 if total > 0 else 0
    return items, total, total_pages


async def create_role(
    db: AsyncSession,
    data: RoleCreate,
) -> Role:
    """Создать роль в справочнике."""
    existing = await db.execute(
        select(Role).where(
            func.lower(Role.name) == data.name.lower(),
            Role.role_type == data.role_type,
            Role.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictError(
            "Область видимости роли с таким наименованием и типом уже существует"
        )

    item = Role(
        name=data.name,
        role_type=data.role_type,
        visibility_scope=visibility_scope_to_dict(data.visibility_scope),
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return _serialize_role(item)


async def update_role(
    db: AsyncSession,
    role_id: int,
    data: RoleUpdate,
) -> Role:
    """Обновить роль в справочнике."""
    item = await get_role_by_id(db, role_id)
    if not item:
        raise NotFoundError("Область видимости роли не найдена")

    if data.name is not None and data.name != item.name:
        if data.name.lower() != item.name.lower():
            existing = await db.execute(
                select(Role).where(
                    func.lower(Role.name) == data.name.lower(),
                    Role.role_type == (data.role_type or item.role_type),
                    Role.deleted_at.is_(None),
                    Role.id != role_id,
                )
            )
            if existing.scalar_one_or_none():
                raise ConflictError(
                    "Область видимости роли с таким наименованием и типом уже существует"
                )
        item.name = data.name

    if data.role_type is not None:
        if data.role_type != item.role_type:
            existing = await db.execute(
                select(Role).where(
                    func.lower(Role.name) == item.name.lower(),
                    Role.role_type == data.role_type,
                    Role.deleted_at.is_(None),
                    Role.id != role_id,
                )
            )
            if existing.scalar_one_or_none():
                raise ConflictError(
                    "Область видимости роли с таким наименованием и типом уже существует"
                )
        item.role_type = data.role_type

    if data.visibility_scope is not None:
        item.visibility_scope = visibility_scope_to_dict(data.visibility_scope)

    await db.flush()
    await db.refresh(item)
    return _serialize_role(item)


async def delete_role(db: AsyncSession, role_id: int) -> None:
    """Мягко удалить роль из справочника."""
    item = await get_role_by_id(db, role_id)
    if not item:
        raise NotFoundError("Область видимости роли не найдена")
    item.soft_delete()
    await db.flush()


__all__ = [
    "get_role_by_id",
    "get_roles_list",
    "create_role",
    "update_role",
    "delete_role",
    "enrich_visibility_scope_labels",
]
