from __future__ import annotations
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import NotFoundError
from models.mass_fraction import MassFractionOilRefractionTable
from repositories import mass_fraction as mass_fraction_repo
from repositories import research as research_repo
from repositories.base import flush_entity
from schemas.mass_fraction import (
    MassFractionOilRefractionTableBulkUpdate,
    MassFractionOilRefractionTableCreate,
    MassFractionOilRefractionTableResponse,
    MassFractionOilRefractionTableUpdate,
)
from utils.pagination import calculate_total_pages


def build_mass_fraction_table_response(
    table: MassFractionOilRefractionTable,
) -> MassFractionOilRefractionTableResponse:
    """Собрать ответ по точке градуировочного графика с названием метода."""
    table_dict = MassFractionOilRefractionTableResponse.model_validate(
        table
    ).model_dump()
    if table.research_method:
        table_dict["research_method_name"] = table.research_method.name
    return MassFractionOilRefractionTableResponse(**table_dict)


async def get_mass_fraction_oil_refraction_table_by_id(
    db: AsyncSession, table_id: int, include_deleted: bool = False
) -> MassFractionOilRefractionTable | None:
    """Получить точку градуировочного графика по ID."""
    return await mass_fraction_repo.get_mass_fraction_oil_refraction_table_by_id(
        db, table_id, include_deleted
    )


async def require_mass_fraction_oil_refraction_table_by_id(
    db: AsyncSession, table_id: int, include_deleted: bool = False
) -> MassFractionOilRefractionTable:
    """Получить точку градуировочного графика по ID или вернуть 404."""
    table = await get_mass_fraction_oil_refraction_table_by_id(
        db, table_id, include_deleted
    )
    if not table:
        raise NotFoundError("Точка градуировочного графика не найдена")
    return table


async def get_mass_fraction_table_response_data(
    db: AsyncSession, table_id: int
) -> MassFractionOilRefractionTableResponse:
    """Получить точку градуировочного графика с данными для ответа API."""
    table = await require_mass_fraction_oil_refraction_table_by_id(db, table_id)
    return build_mass_fraction_table_response(table)


async def get_mass_fraction_oil_refraction_tables(
    db: AsyncSession,
    research_method_id: int | None = None,
    page: int | None = None,
    page_size: int | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[MassFractionOilRefractionTable], int, int]:
    """Получить точки градуировочного графика."""
    tables, total = await mass_fraction_repo.get_mass_fraction_oil_refraction_tables(
        db, research_method_id, page, page_size, sort_by, sort_order
    )

    if page is not None and page_size is not None:
        total_pages = calculate_total_pages(total, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    return tables, total, total_pages


async def get_mass_fraction_tables_response_data(
    db: AsyncSession,
    research_method_id: int | None = None,
    page: int | None = None,
    page_size: int | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[MassFractionOilRefractionTableResponse], int, int]:
    """Список точек градуировочного графика с данными для ответа API."""
    tables, total, total_pages = await get_mass_fraction_oil_refraction_tables(
        db,
        research_method_id=research_method_id,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    items = [build_mass_fraction_table_response(table) for table in tables]
    return items, total, total_pages


async def create_mass_fraction_oil_refraction_table(
    db: AsyncSession, table_data: MassFractionOilRefractionTableCreate
) -> MassFractionOilRefractionTable:
    """Создать точку градуировочного графика."""
    if not await research_repo.get_research_method_by_id(
        db, table_data.research_method_id
    ):
        raise NotFoundError("Метод исследования не найден")

    table = MassFractionOilRefractionTable(
        research_method_id=table_data.research_method_id,
        c_value=table_data.c_value,
        n_value=table_data.n_value,
    )
    return await mass_fraction_repo.add_mass_fraction_oil_refraction_table(db, table)


async def update_mass_fraction_oil_refraction_table(
    db: AsyncSession, table_id: int, table_data: MassFractionOilRefractionTableUpdate
) -> MassFractionOilRefractionTable:
    """Обновить точку градуировочного графика."""
    table = await require_mass_fraction_oil_refraction_table_by_id(db, table_id)

    update_data = table_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(table, key, value)

    await flush_entity(db)
    return table


async def delete_mass_fraction_oil_refraction_table(
    db: AsyncSession, table_id: int
) -> None:
    """Удалить точку градуировочного графика (мягкое удаление)."""
    table = await require_mass_fraction_oil_refraction_table_by_id(db, table_id)
    table.soft_delete()
    await flush_entity(db)


async def bulk_update_mass_fraction_oil_refraction_tables(
    db: AsyncSession, bulk_data: MassFractionOilRefractionTableBulkUpdate
) -> dict:
    """Массовое обновление градуировочного графика."""
    research_method_id = bulk_data.research_method_id
    new_entries = bulk_data.entries

    if not await research_repo.get_research_method_by_id(db, research_method_id):
        raise NotFoundError("Метод исследования не найден")

    active_tables, _, _ = await get_mass_fraction_oil_refraction_tables(
        db, research_method_id=research_method_id
    )
    active_tables = [table for table in active_tables if not table.deleted_at]

    existing_entries_map = {}
    for entry in active_tables:
        key = (Decimal(str(entry.c_value)), Decimal(str(entry.n_value)))
        existing_entries_map[key] = entry

    new_entries_map = {}
    for entry in new_entries:
        c_value = Decimal(str(entry.get("c_value", 0)))
        n_value = Decimal(str(entry.get("n_value", 0)))
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
        return {"message": "Изменений не обнаружено"}

    for entry in entries_to_deactivate:
        await delete_mass_fraction_oil_refraction_table(db, entry.id)

    created_count = 0
    for entry_data in entries_to_create:
        await create_mass_fraction_oil_refraction_table(
            db,
            MassFractionOilRefractionTableCreate(
                research_method_id=research_method_id,
                c_value=str(entry_data.get("c_value")),
                n_value=str(entry_data.get("n_value")),
            ),
        )
        created_count += 1

    return {
        "message": "Градуировочный график успешно обновлен",
        "created": created_count,
        "deactivated": len(entries_to_deactivate),
    }
