from __future__ import annotations
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import NotFoundError
from models.mass_fraction import MassFractionOilRefractionTable
from repositories import mass_fraction as mass_fraction_repo, research as research_repo
from repositories.base import flush_entity
from schemas.mass_fraction import (
    MassFractionOilRefractionTableBulkUpdate,
    MassFractionOilRefractionTableBulkUpdateResponse,
    MassFractionOilRefractionTableCreate,
    MassFractionOilRefractionTableUpdate,
)
from schemas.role import UserPermissionsResponse
from services.access_control import enforce_crud_access
from services.research import require_research_method_by_id


async def get_mass_fraction_oil_refraction_table_by_id(
    db: AsyncSession, table_id: int, include_deleted: bool = False
) -> MassFractionOilRefractionTable | None:
    """Получить точку градуировочного графика по ID."""
    return await mass_fraction_repo.get_mass_fraction_oil_refraction_table_by_id(db, table_id, include_deleted)


async def require_mass_fraction_oil_refraction_table_by_id(
    db: AsyncSession, table_id: int, include_deleted: bool = False
) -> MassFractionOilRefractionTable:
    """Получить точку градуировочного графика по ID или вернуть 404."""
    table = await get_mass_fraction_oil_refraction_table_by_id(db, table_id, include_deleted)
    if not table:
        raise NotFoundError("Точка градуировочного графика не найдена")
    return table


async def get_mass_fraction_oil_refraction_tables(
    db: AsyncSession,
    research_method_id: int | None = None,
    page: int | None = None,
    page_size: int | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[MassFractionOilRefractionTable], int]:
    """Получить точки градуировочного графика."""
    tables, total = await mass_fraction_repo.get_mass_fraction_oil_refraction_tables(
        db, research_method_id, page, page_size, sort_by, sort_order
    )

    return tables, total


async def create_mass_fraction_oil_refraction_table(
    db: AsyncSession, table_data: MassFractionOilRefractionTableCreate
) -> MassFractionOilRefractionTable:
    """Создать точку градуировочного графика."""
    if not await research_repo.get_research_method_by_id(db, table_data.research_method_id):
        raise NotFoundError("Метод исследования не найден")

    table = MassFractionOilRefractionTable(
        research_method_id=table_data.research_method_id,
        c_value=table_data.c_value,
        n_value=table_data.n_value,
    )
    table = await mass_fraction_repo.add_mass_fraction_oil_refraction_table(db, table)
    return await require_mass_fraction_oil_refraction_table_by_id(db, table.id)


async def update_mass_fraction_oil_refraction_table(
    db: AsyncSession, table_id: int, table_data: MassFractionOilRefractionTableUpdate
) -> MassFractionOilRefractionTable:
    """Обновить точку градуировочного графика."""
    table = await require_mass_fraction_oil_refraction_table_by_id(db, table_id)

    update_data = table_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(table, key, value)

    await flush_entity(db)
    return await require_mass_fraction_oil_refraction_table_by_id(db, table_id)


async def delete_mass_fraction_oil_refraction_table(db: AsyncSession, table_id: int) -> None:
    """Удалить точку градуировочного графика (мягкое удаление)."""
    table = await require_mass_fraction_oil_refraction_table_by_id(db, table_id)
    table.soft_delete()
    await flush_entity(db)


async def bulk_update_mass_fraction_oil_refraction_tables(
    db: AsyncSession, bulk_data: MassFractionOilRefractionTableBulkUpdate
) -> MassFractionOilRefractionTableBulkUpdateResponse:
    """Выполнить массовое обновление градуировочного графика."""
    research_method_id = bulk_data.research_method_id
    new_entries = bulk_data.entries

    if not await research_repo.get_research_method_by_id(db, research_method_id):
        raise NotFoundError("Метод исследования не найден")

    active_tables, _ = await get_mass_fraction_oil_refraction_tables(db, research_method_id=research_method_id)
    active_tables = [table for table in active_tables if not table.deleted_at]

    existing_entries_map = {}
    for entry in active_tables:
        key = (Decimal(str(entry.c_value)), Decimal(str(entry.n_value)))
        existing_entries_map[key] = entry

    new_entries_map = {}
    for entry in new_entries:
        c_value = Decimal(str(entry.c_value))
        n_value = Decimal(str(entry.n_value))
        key = (c_value, n_value)
        new_entries_map[key] = entry

    entries_to_deactivate = []
    entries_to_create = []

    for key, existing_entry in existing_entries_map.items():
        if key not in new_entries_map:
            entries_to_deactivate.append(existing_entry)

    for key, new_entry_data in new_entries_map.items():
        if key not in existing_entries_map:
            entries_to_create.append(new_entry_data)

    if not entries_to_deactivate and not entries_to_create:
        return MassFractionOilRefractionTableBulkUpdateResponse(message="Изменений не обнаружено")

    for entry in entries_to_deactivate:
        await delete_mass_fraction_oil_refraction_table(db, entry.id)

    created_count = 0
    for entry_data in entries_to_create:
        await create_mass_fraction_oil_refraction_table(
            db,
            MassFractionOilRefractionTableCreate(
                research_method_id=research_method_id,
                c_value=entry_data.c_value,
                n_value=entry_data.n_value,
            ),
        )
        created_count += 1

    return MassFractionOilRefractionTableBulkUpdateResponse(
        message="Градуировочный график успешно обновлен",
        created=created_count,
        deactivated=len(entries_to_deactivate),
    )


async def list_with_access(
    db: AsyncSession,
    effective: UserPermissionsResponse,
    *,
    research_method_id: int | None = None,
    page: int | None = None,
    page_size: int | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[MassFractionOilRefractionTable], int]:
    """Получить точки градуировочного графика с проверкой прав доступа."""
    if research_method_id is not None:
        method = await require_research_method_by_id(db, research_method_id)
        enforce_crud_access(
            effective,
            "refraction_tables",
            "read",
            method.laboratory_id,
            method.department_id,
        )
    else:
        enforce_crud_access(effective, "refraction_tables", "read")

    return await get_mass_fraction_oil_refraction_tables(
        db,
        research_method_id=research_method_id,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )


async def create_with_access(
    db: AsyncSession,
    effective: UserPermissionsResponse,
    table_data: MassFractionOilRefractionTableCreate,
) -> MassFractionOilRefractionTable:
    """Создать точку градуировочного графика с проверкой прав доступа."""
    method = await require_research_method_by_id(db, table_data.research_method_id)
    enforce_crud_access(
        effective,
        "refraction_tables",
        "create",
        method.laboratory_id,
        method.department_id,
    )
    return await create_mass_fraction_oil_refraction_table(db, table_data)


async def update_with_access(
    db: AsyncSession,
    effective: UserPermissionsResponse,
    table_id: int,
    table_data: MassFractionOilRefractionTableUpdate,
) -> MassFractionOilRefractionTable:
    """Обновить точку градуировочного графика с проверкой прав доступа."""
    table = await require_mass_fraction_oil_refraction_table_by_id(db, table_id)
    method = await require_research_method_by_id(db, table.research_method_id)
    enforce_crud_access(
        effective,
        "refraction_tables",
        "update",
        method.laboratory_id,
        method.department_id,
    )
    return await update_mass_fraction_oil_refraction_table(db, table_id, table_data)


async def delete_with_access(
    db: AsyncSession,
    effective: UserPermissionsResponse,
    table_id: int,
) -> None:
    """Удалить точку градуировочного графика с проверкой прав доступа."""
    table = await require_mass_fraction_oil_refraction_table_by_id(db, table_id)
    method = await require_research_method_by_id(db, table.research_method_id)
    enforce_crud_access(
        effective,
        "refraction_tables",
        "delete",
        method.laboratory_id,
        method.department_id,
    )
    await delete_mass_fraction_oil_refraction_table(db, table_id)


async def bulk_update_with_access(
    db: AsyncSession,
    effective: UserPermissionsResponse,
    bulk_data: MassFractionOilRefractionTableBulkUpdate,
) -> MassFractionOilRefractionTableBulkUpdateResponse:
    """Выполнить массовое обновление градуировочного графика с проверкой прав доступа."""
    method = await require_research_method_by_id(db, bulk_data.research_method_id)
    enforce_crud_access(
        effective,
        "refraction_tables",
        "update",
        method.laboratory_id,
        method.department_id,
    )
    return await bulk_update_mass_fraction_oil_refraction_tables(db, bulk_data)
