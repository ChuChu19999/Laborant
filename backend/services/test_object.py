from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import ConflictError, NotFoundError, ValidationError
from models.test_object import TestObject
from repositories import test_object as test_object_repo
from repositories.base import flush_entity, refresh_entity
from schemas.test_object import (
    TestObjectCreate,
    TestObjectResponse,
    TestObjectUpdate,
)
from schemas.visibility import (
    VisibilityScope,
    VisibilityScopeEntity,
    visibility_scope_to_dict,
)
from services.visibility import enrich_visibility_scope_labels
from utils.pagination import calculate_total_pages
from utils.visibility_scope import (
    is_visible_in_scope,
    normalize_visibility_scope,
)


def _serialize_test_object(item: TestObject) -> TestObject:
    return item


async def get_test_object_tags(db: AsyncSession) -> set[str]:
    """Получить теги из справочника объектов испытаний."""
    return await test_object_repo.get_test_object_tags(db)


async def validate_research_method_sample_types(
    db: AsyncSession,
    sample_types: list[str],
) -> None:
    """Проверить, что типы проб совпадают с тегами справочника объектов испытаний."""
    if not sample_types:
        raise ValidationError("Не указаны объекты испытаний")

    valid_tags = await get_test_object_tags(db)
    if not valid_tags:
        raise ValidationError(
            "Справочник объектов испытаний пуст. Сначала добавьте объекты испытаний."
        )

    invalid = [
        sample_type for sample_type in sample_types if sample_type not in valid_tags
    ]
    if invalid:
        raise ValidationError(
            "Недопустимый тип пробы: "
            f"{', '.join(invalid)}. "
            "Допустимые теги из справочника объектов испытаний: "
            f"{', '.join(sorted(valid_tags))}"
        )


async def get_test_object_by_id(
    db: AsyncSession,
    test_object_id: int,
    include_deleted: bool = False,
) -> TestObject | None:
    """Получить объект испытаний по ID."""
    item = await test_object_repo.get_test_object_by_id(
        db, test_object_id, include_deleted
    )
    if item:
        return _serialize_test_object(item)
    return None


async def require_test_object_by_id(
    db: AsyncSession,
    test_object_id: int,
    include_deleted: bool = False,
) -> TestObject:
    """Получить объект испытаний по ID или вернуть 404."""
    item = await get_test_object_by_id(db, test_object_id, include_deleted)
    if not item:
        raise NotFoundError("Объект испытаний не найден")
    return item


async def get_test_objects_list(
    db: AsyncSession,
    page: int | None = None,
    page_size: int | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    for_select: bool = False,
) -> tuple[list[TestObject], int, int]:
    """Получить список объектов испытаний из справочника."""
    items = [
        _serialize_test_object(item)
        for item in await test_object_repo.get_test_objects(
            db, search, sort_by, sort_order
        )
    ]

    if for_select or laboratory_id or department_id:
        items = [
            item
            for item in items
            if is_visible_in_scope(
                normalize_visibility_scope(item.visibility_scope),
                laboratory_id=laboratory_id,
                department_id=department_id,
            )
        ]

    total = len(items)

    if page is not None and page_size is not None:
        offset = (page - 1) * page_size
        items = items[offset : offset + page_size]

    if page_size:
        total_pages = calculate_total_pages(total, page_size)
    else:
        total_pages = 1 if total > 0 else 0
    return items, total, total_pages


async def get_test_object_names(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> list[str]:
    """Получить наименования объектов испытаний для селектов."""
    items, _, _ = await get_test_objects_list(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        for_select=True,
    )
    return [item.name for item in items]


async def resolve_tag_by_name(
    db: AsyncSession,
    test_object_name: str | None,
) -> str | None:
    """Найти тег справочника по наименованию объекта испытаний."""
    if not test_object_name or not test_object_name.strip():
        return None

    return await test_object_repo.resolve_tag_by_name(db, test_object_name)


async def get_protocol_abbreviations_by_names(
    db: AsyncSession,
    names: list[str],
) -> dict[str, str]:
    """Аббревиатуры протокола по наименованиям объектов испытаний."""
    return await test_object_repo.get_protocol_abbreviations_by_names(db, names)


def pick_protocol_abbreviation(
    abbreviations_by_name: dict[str, str],
    test_object_name: str | None,
) -> str:
    """Взять аббревиатуру из заранее загруженного словаря по имени объекта."""
    if not test_object_name or not test_object_name.strip():
        return ""
    return abbreviations_by_name.get(test_object_name.strip().lower(), "")


def pick_first_protocol_abbreviation(
    abbreviations_by_name: dict[str, str],
    test_object_names: list[str | None],
) -> str:
    """Первая непустая аббревиатура по списку наименований."""
    for name in test_object_names:
        abbreviation = pick_protocol_abbreviation(abbreviations_by_name, name)
        if abbreviation:
            return abbreviation
    return ""


async def build_test_object_response(
    db: AsyncSession, item: TestObject
) -> TestObjectResponse:
    """Собрать ответ API по объекту испытаний."""
    scope = normalize_visibility_scope(item.visibility_scope)
    item_id = item.id
    name = item.name
    tag = item.tag
    protocol_abbreviation = item.protocol_abbreviation
    created_at = item.created_at
    updated_at = item.updated_at
    deleted_at = item.deleted_at

    labels = await enrich_visibility_scope_labels(db, scope)
    return TestObjectResponse(
        id=item_id,
        name=name,
        tag=tag,
        protocol_abbreviation=protocol_abbreviation,
        visibility_scope=VisibilityScope(
            laboratory_ids=scope.get("laboratory_ids", []),
            department_ids=scope.get("department_ids", []),
            laboratories=[
                VisibilityScopeEntity(**entry)
                for entry in labels.get("laboratories", [])
            ],
            departments=[
                VisibilityScopeEntity(**entry)
                for entry in labels.get("departments", [])
            ],
        ),
        created_at=created_at,
        updated_at=updated_at,
        deleted_at=deleted_at,
    )


async def get_test_object_response(
    db: AsyncSession,
    test_object_id: int,
    include_deleted: bool = False,
) -> TestObjectResponse:
    item = await require_test_object_by_id(db, test_object_id, include_deleted)
    return await build_test_object_response(db, item)


async def get_test_objects_response_list(
    db: AsyncSession,
    page: int | None = None,
    page_size: int | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> tuple[list[TestObjectResponse], int, int]:
    items, total, total_pages = await get_test_objects_list(
        db,
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        laboratory_id=laboratory_id,
        department_id=department_id,
    )
    responses = [await build_test_object_response(db, item) for item in items]
    return responses, total, total_pages


async def create_test_object(
    db: AsyncSession,
    data: TestObjectCreate,
) -> TestObjectResponse:
    """Создать объект испытаний в справочнике."""
    if await test_object_repo.exists_test_object_by_name(db, data.name):
        raise ConflictError("Объект испытаний с таким наименованием уже существует")

    item = TestObject(
        name=data.name,
        tag=data.tag,
        protocol_abbreviation=data.protocol_abbreviation,
        visibility_scope=visibility_scope_to_dict(data.visibility_scope),
    )
    item = await test_object_repo.add_test_object(db, item)
    return await build_test_object_response(db, item)


async def update_test_object(
    db: AsyncSession,
    test_object_id: int,
    data: TestObjectUpdate,
) -> TestObjectResponse:
    """Обновить объект испытаний в справочнике."""
    item = await require_test_object_by_id(db, test_object_id)

    if data.name is not None and data.name != item.name:
        if data.name.lower() != item.name.lower():
            if await test_object_repo.exists_test_object_by_name(
                db, data.name, exclude_id=test_object_id
            ):
                raise ConflictError(
                    "Объект испытаний с таким наименованием уже существует"
                )
        item.name = data.name

    if data.tag is not None:
        item.tag = data.tag

    update_data = data.model_dump(exclude_unset=True)
    if "protocol_abbreviation" in update_data:
        item.protocol_abbreviation = update_data["protocol_abbreviation"]

    if data.visibility_scope is not None:
        item.visibility_scope = visibility_scope_to_dict(data.visibility_scope)

    await flush_entity(db)
    await refresh_entity(db, item)
    return await build_test_object_response(db, item)


async def delete_test_object(db: AsyncSession, test_object_id: int) -> None:
    """Мягко удалить объект испытаний из справочника."""
    item = await require_test_object_by_id(db, test_object_id)
    item.soft_delete()
    await flush_entity(db)
