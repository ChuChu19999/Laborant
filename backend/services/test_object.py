from __future__ import annotations
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import set_committed_value
from core.exceptions import ConflictError, DomainValidationError, NotFoundError
from models.test_object import TestObject
from repositories import test_object as test_object_repo
from repositories.base import flush_entity, refresh_entity
from schemas.test_object import (
    TestObjectCreate,
    TestObjectResponse,
    TestObjectSelectItem,
    TestObjectUpdate,
)
from services.visibility import (
    apply_visibility_scope_labels,
    enrich_visibility_scope_labels,
    load_lab_dept_name_maps,
    validate_visibility_scope_ids,
    visibility_scope_to_dict,
)
from utils.visibility_scope import normalize_visibility_scope


async def _attach_visibility_scope_labels(db: AsyncSession, item: TestObject) -> TestObject:
    """Добавить названия лабораторий и подразделений в область видимости без пометки ORM изменённым."""
    scope = normalize_visibility_scope(item.visibility_scope)
    labels = await enrich_visibility_scope_labels(db, scope)
    set_committed_value(item, "visibility_scope", labels)
    return item


async def attach_visibility_scope_labels_batch(db: AsyncSession, items: list[TestObject]) -> list[TestObject]:
    """Добавить названия в области видимости списка одной пакетной загрузкой справочников."""
    scopes = [normalize_visibility_scope(item.visibility_scope) for item in items]
    laboratory_ids = sorted({lab_id for scope in scopes for lab_id in scope["laboratory_ids"]})
    department_ids = sorted({dept_id for scope in scopes for dept_id in scope["department_ids"]})
    lab_names, dept_names = await load_lab_dept_name_maps(db, laboratory_ids, department_ids)
    for item, scope in zip(items, scopes, strict=True):
        set_committed_value(
            item,
            "visibility_scope",
            apply_visibility_scope_labels(scope, lab_names, dept_names),
        )
    return items


async def get_test_object_tags(db: AsyncSession) -> set[str]:
    """Получить теги из справочника объектов испытаний."""
    return await test_object_repo.get_test_object_tags(db)


async def validate_research_method_sample_types(
    db: AsyncSession,
    sample_types: list[str],
) -> None:
    """Проверить, что типы проб совпадают с тегами справочника объектов испытаний."""
    if not sample_types:
        raise DomainValidationError("Не указаны объекты испытаний")

    valid_tags = await get_test_object_tags(db)
    if not valid_tags:
        raise DomainValidationError("Справочник объектов испытаний пуст. Сначала добавьте объекты испытаний.")

    invalid = [sample_type for sample_type in sample_types if sample_type not in valid_tags]
    if invalid:
        raise DomainValidationError(
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
    return await test_object_repo.get_test_object_by_id(db, test_object_id, include_deleted)


async def require_test_object_by_id(
    db: AsyncSession,
    test_object_id: int,
    include_deleted: bool = False,
) -> TestObject:
    """Вернуть объект испытаний по ID, иначе вызвать NotFoundError."""
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
) -> tuple[list[TestObject], int]:
    """Получить список объектов испытаний из справочника."""
    return await test_object_repo.get_test_objects(
        db,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
        laboratory_id=laboratory_id,
        department_id=department_id,
        apply_visibility_filter=for_select or laboratory_id is not None or department_id is not None,
    )


async def get_test_object_names(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> list[str]:
    """Получить наименования объектов испытаний для селектов."""
    items, _ = await get_test_objects_list(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        for_select=True,
    )
    return [item.name for item in items]


async def get_test_objects_for_select(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> list[TestObjectSelectItem]:
    """Вернуть объекты испытаний для селектов форм."""
    items, _ = await get_test_objects_list(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        for_select=True,
    )
    return [TestObjectSelectItem(name=item.name, tag=item.tag) for item in items]


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
    """Получить аббревиатуры протокола по наименованиям объектов испытаний."""
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
    """Взять первую непустую аббревиатуру по списку наименований."""
    for name in test_object_names:
        abbreviation = pick_protocol_abbreviation(abbreviations_by_name, name)
        if abbreviation:
            return abbreviation
    return ""


async def get_test_object_for_response(
    db: AsyncSession,
    test_object_id: int,
    include_deleted: bool = False,
) -> TestObjectResponse:
    """Получить объект испытаний для ответа API с названиями в области видимости."""
    item = await require_test_object_by_id(db, test_object_id, include_deleted)
    item = await _attach_visibility_scope_labels(db, item)
    return build_test_object_response(item)


def build_test_object_response(item: TestObject) -> TestObjectResponse:
    """Собрать TestObjectResponse из ORM-объекта испытаний."""
    return TestObjectResponse.model_validate(item)


async def create_test_object_for_response(db: AsyncSession, data: TestObjectCreate) -> TestObjectResponse:
    """Создать объект испытаний и вернуть ответ API."""
    item = await create_test_object(db, data)
    return build_test_object_response(item)


async def update_test_object_for_response(
    db: AsyncSession,
    test_object_id: int,
    data: TestObjectUpdate,
) -> TestObjectResponse:
    """Обновить объект испытаний и вернуть ответ API."""
    item = await update_test_object(db, test_object_id, data)
    return build_test_object_response(item)


async def get_test_objects_for_response(
    db: AsyncSession,
    page: int | None = None,
    page_size: int | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> tuple[list[TestObject], int]:
    """Получить список объектов испытаний с названиями в области видимости."""
    items, total = await get_test_objects_list(
        db,
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        laboratory_id=laboratory_id,
        department_id=department_id,
    )
    labeled = await attach_visibility_scope_labels_batch(db, items)
    return labeled, total


async def create_test_object(
    db: AsyncSession,
    data: TestObjectCreate,
) -> TestObject:
    """Создать объект испытаний в справочнике."""
    if await test_object_repo.exists_test_object_by_name(db, data.name):
        raise ConflictError("Объект испытаний с таким наименованием уже существует")

    scope = visibility_scope_to_dict(data.visibility_scope)
    await validate_visibility_scope_ids(db, scope)

    item = TestObject(
        name=data.name,
        tag=data.tag,
        protocol_abbreviation=data.protocol_abbreviation,
        visibility_scope=scope,
    )
    item = await test_object_repo.add_test_object(db, item)
    return await _attach_visibility_scope_labels(db, item)


async def update_test_object(
    db: AsyncSession,
    test_object_id: int,
    data: TestObjectUpdate,
) -> TestObject:
    """Обновить объект испытаний в справочнике."""
    item = await require_test_object_by_id(db, test_object_id)

    if data.name is not None and data.name != item.name and data.name.lower() != item.name.lower():
        if await test_object_repo.exists_test_object_by_name(db, data.name, exclude_id=test_object_id):
            raise ConflictError("Объект испытаний с таким наименованием уже существует")
        item.name = data.name

    if data.tag is not None:
        item.tag = data.tag

    update_data = data.model_dump(exclude_unset=True)
    if "protocol_abbreviation" in update_data:
        item.protocol_abbreviation = update_data["protocol_abbreviation"]

    if data.visibility_scope is not None:
        scope = visibility_scope_to_dict(data.visibility_scope)
        await validate_visibility_scope_ids(db, scope)
        item.visibility_scope = scope

    await flush_entity(db)
    await refresh_entity(db, item)
    return await _attach_visibility_scope_labels(db, item)


async def delete_test_object(db: AsyncSession, test_object_id: int) -> None:
    """Мягко удалить объект испытаний из справочника."""
    item = await require_test_object_by_id(db, test_object_id)
    item.soft_delete()
    await flush_entity(db)
