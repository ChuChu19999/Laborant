from __future__ import annotations
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import NotFoundError, ValidationError
from repositories import laboratory as laboratory_repo
from utils.visibility_scope import normalize_visibility_scope


async def enrich_visibility_scope_labels(
    db: AsyncSession,
    visibility_scope: dict,
) -> dict:
    """Добавить названия лабораторий и подразделений для отображения в таблице."""
    scope = normalize_visibility_scope(visibility_scope)
    laboratory_ids = scope["laboratory_ids"]
    department_ids = scope["department_ids"]

    laboratories: list[dict] = []
    departments: list[dict] = []

    if laboratory_ids:
        laboratories = [
            {"id": row[0], "name": row[1]}
            for row in await laboratory_repo.get_laboratories_for_visibility_scope(
                db, laboratory_ids
            )
        ]

    if department_ids:
        departments = [
            {
                "id": row[0],
                "name": f"{row[3] or row[2]} — {row[1]}",
            }
            for row in await laboratory_repo.get_departments_for_visibility_scope(
                db, department_ids
            )
        ]

    return {
        **scope,
        "laboratories": laboratories,
        "departments": departments,
    }


async def validate_lab_and_department(
    db: AsyncSession,
    laboratory_id: int,
    department_id: int | None,
) -> None:
    """Проверить существование лаборатории и принадлежность подразделения."""
    if not await laboratory_repo.get_laboratory_by_id(db, laboratory_id):
        raise NotFoundError("Лаборатория не найдена")

    if department_id:
        dept = await laboratory_repo.get_department_by_id(db, department_id)
        if not dept:
            raise NotFoundError("Подразделение не найдено")
        if dept.laboratory_id != laboratory_id:
            raise ValidationError(
                "Подразделение должно принадлежать выбранной лаборатории"
            )


async def validate_visibility_scope_ids(
    db: AsyncSession,
    visibility_scope: dict,
) -> None:
    """Проверить, что все id лабораторий и подразделений есть в БД (включая мягко удалённые)."""
    scope = normalize_visibility_scope(visibility_scope)
    laboratory_ids = scope["laboratory_ids"]
    department_ids = scope["department_ids"]

    for laboratory_id in laboratory_ids:
        if not await laboratory_repo.get_laboratory_by_id(
            db, laboratory_id, include_deleted=True
        ):
            raise NotFoundError("Лаборатория не найдена")

    for department_id in department_ids:
        if not await laboratory_repo.get_department_by_id(
            db, department_id, include_deleted=True
        ):
            raise NotFoundError("Подразделение не найдено")


async def validate_role_scopes_ids(
    db: AsyncSession,
    scopes: list[dict],
) -> None:
    """Проверить id в привязках роли и принадлежность подразделения лаборатории."""
    for entry in scopes:
        laboratory_id = entry.get("laboratory_id")
        department_id = entry.get("department_id")
        if not isinstance(laboratory_id, int) or laboratory_id <= 0:
            raise ValidationError("Некорректный идентификатор лаборатории в привязке")
        if not await laboratory_repo.get_laboratory_by_id(
            db, laboratory_id, include_deleted=True
        ):
            raise NotFoundError("Лаборатория не найдена")
        if department_id is None:
            continue
        if not isinstance(department_id, int) or department_id <= 0:
            raise ValidationError("Некорректный идентификатор подразделения в привязке")
        dept = await laboratory_repo.get_department_by_id(
            db, department_id, include_deleted=True
        )
        if not dept:
            raise NotFoundError("Подразделение не найдено")
        if dept.laboratory_id != laboratory_id:
            raise ValidationError(
                "Подразделение должно принадлежать выбранной лаборатории"
            )


async def load_lab_dept_name_maps(
    db: AsyncSession,
    laboratory_ids: list[int],
    department_ids: list[int],
) -> tuple[dict[int, str], dict[int, str]]:
    """Загрузить названия лабораторий и подразделений одним запросом на каждый тип."""
    lab_names: dict[int, str] = {}
    if laboratory_ids:
        for row in await laboratory_repo.get_laboratories_for_visibility_scope(
            db, laboratory_ids
        ):
            lab_names[int(row[0])] = str(row[1])

    dept_names: dict[int, str] = {}
    if department_ids:
        for row in await laboratory_repo.get_departments_for_visibility_scope(
            db, department_ids
        ):
            dept_names[int(row[0])] = f"{row[3] or row[2]} — {row[1]}"

    return lab_names, dept_names


def apply_role_scope_labels(
    scopes: list[dict],
    lab_names: dict[int, str],
    dept_names: dict[int, str],
) -> list[dict]:
    """Подставить названия в привязки роли из уже загруженных словарей."""
    result: list[dict] = []
    for entry in scopes:
        laboratory_id = entry["laboratory_id"]
        department_id = entry.get("department_id")
        result.append(
            {
                **entry,
                "laboratory_name": lab_names.get(laboratory_id),
                "department_name": (
                    dept_names.get(department_id)
                    if isinstance(department_id, int)
                    else None
                ),
            }
        )
    return result


def collect_role_scope_ids(
    scopes_lists: list[list[dict]],
) -> tuple[list[int], list[int]]:
    """Собрать уникальные id лабораторий и подразделений из набора привязок."""
    laboratory_ids: set[int] = set()
    department_ids: set[int] = set()
    for scopes in scopes_lists:
        for entry in scopes:
            laboratory_id = entry.get("laboratory_id")
            if isinstance(laboratory_id, int):
                laboratory_ids.add(laboratory_id)
            department_id = entry.get("department_id")
            if isinstance(department_id, int):
                department_ids.add(department_id)
    return sorted(laboratory_ids), sorted(department_ids)


async def enrich_role_scopes_labels(
    db: AsyncSession,
    scopes: list[dict],
) -> list[dict]:
    """Добавить названия лабораторий и подразделений к привязкам роли."""
    if not scopes:
        return []

    laboratory_ids, department_ids = collect_role_scope_ids([scopes])
    lab_names, dept_names = await load_lab_dept_name_maps(
        db, laboratory_ids, department_ids
    )
    return apply_role_scope_labels(scopes, lab_names, dept_names)
