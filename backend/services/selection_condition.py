from __future__ import annotations
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import DomainValidationError, NotFoundError
from models.department import Department
from models.laboratory import Laboratory
from models.selection_conditions import SelectionConditions
from repositories import (
    department as department_repo,
    laboratory as laboratory_repo,
    selection_conditions as selection_conditions_repo,
)
from repositories.base import flush_entity
from schemas.selection_conditions import (
    SelectionConditionsCreate,
    SelectionConditionsUpdate,
)


async def get_selection_conditions_by_id(
    db: AsyncSession, conditions_id: int, include_deleted: bool = False
) -> SelectionConditions | None:
    """Получить условия отбора по ID."""
    return await selection_conditions_repo.get_selection_conditions_by_id(db, conditions_id, include_deleted)


async def require_selection_conditions_by_id(
    db: AsyncSession, conditions_id: int, include_deleted: bool = False
) -> SelectionConditions:
    """Вернуть условия отбора по ID, иначе вызвать NotFoundError."""
    conditions = await get_selection_conditions_by_id(db, conditions_id, include_deleted)
    if not conditions:
        raise NotFoundError("Условия отбора не найдены")
    return conditions


async def get_selection_conditions(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    page: int | None = None,
    page_size: int | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[SelectionConditions], int]:
    """Получить список условий отбора."""
    selection_conditions, total = await selection_conditions_repo.get_selection_conditions(
        db, laboratory_id, department_id, page, page_size, sort_by, sort_order
    )

    return selection_conditions, total


async def _resolve_lab_and_department(
    db: AsyncSession,
    laboratory_id: int | None,
    department_id: int | None,
) -> tuple[Laboratory | None, Department | None]:
    """Проверить лабораторию и подразделение и вернуть загруженные сущности."""
    if laboratory_id is None and department_id is None:
        raise DomainValidationError("Условия отбора должны быть привязаны к лаборатории или подразделению")

    laboratory: Laboratory | None = None
    if laboratory_id is not None:
        laboratory = await laboratory_repo.get_laboratory_by_id(db, laboratory_id)
        if not laboratory:
            raise NotFoundError("Лаборатория не найдена")

    department: Department | None = None
    if department_id is not None:
        department = await department_repo.get_department_by_id(db, department_id)
        if not department:
            raise NotFoundError("Подразделение не найдено")
        if laboratory_id is not None and department.laboratory_id != laboratory_id:
            raise DomainValidationError("Подразделение должно принадлежать выбранной лаборатории")

    return laboratory, department


async def create_selection_conditions(
    db: AsyncSession, conditions_data: SelectionConditionsCreate
) -> SelectionConditions:
    """Создать условия отбора."""
    laboratory, department = await _resolve_lab_and_department(
        db,
        conditions_data.laboratory_id,
        conditions_data.department_id,
    )

    selection_conditions = SelectionConditions(
        conditions=conditions_data.conditions,
        laboratory_id=conditions_data.laboratory_id,
        department_id=conditions_data.department_id,
    )
    selection_conditions = await selection_conditions_repo.add_selection_conditions(db, selection_conditions)
    selection_conditions.laboratory = laboratory
    selection_conditions.department = department
    return selection_conditions


async def update_selection_conditions(
    db: AsyncSession,
    selection_conditions: SelectionConditions,
    conditions_data: SelectionConditionsUpdate,
) -> SelectionConditions:
    """Обновить условия отбора."""
    update_data = conditions_data.model_dump(exclude_unset=True)

    scope_changed = conditions_data.laboratory_id is not None or conditions_data.department_id is not None
    if scope_changed:
        lab_id = (
            conditions_data.laboratory_id
            if conditions_data.laboratory_id is not None
            else selection_conditions.laboratory_id
        )
        dept_id = (
            conditions_data.department_id
            if conditions_data.department_id is not None
            else selection_conditions.department_id
        )
        await _resolve_lab_and_department(db, lab_id, dept_id)

    for key, value in update_data.items():
        setattr(selection_conditions, key, value)

    await flush_entity(db)
    return await require_selection_conditions_by_id(db, selection_conditions.id)


async def delete_selection_conditions(db: AsyncSession, selection_conditions: SelectionConditions) -> None:
    """Мягко удалить условия отбора."""
    selection_conditions.soft_delete()
    await flush_entity(db)


def resolve_selection_conditions_update_scope(
    conditions: SelectionConditions,
    conditions_data: SelectionConditionsUpdate,
) -> tuple[int | None, int | None]:
    """Определить область доступа после PATCH условий отбора."""
    fields_set = conditions_data.model_fields_set
    laboratory_id = (
        conditions_data.laboratory_id
        if "laboratory_id" in fields_set and conditions_data.laboratory_id is not None
        else conditions.laboratory_id
    )
    department_id = conditions_data.department_id if "department_id" in fields_set else conditions.department_id
    return (laboratory_id, department_id)
