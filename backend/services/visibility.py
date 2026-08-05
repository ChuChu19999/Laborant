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
