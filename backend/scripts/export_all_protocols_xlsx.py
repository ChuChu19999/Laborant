"""
Сформировать один .xlsx со всеми неудалёнными протоколами (каждый на отдельном листе).

Запуск из каталога backend:

    python scripts/export_all_protocols_xlsx.py
    python scripts/export_all_protocols_xlsx.py -o ../all_protocols.xlsx
    python scripts/export_all_protocols_xlsx.py --laboratory-id 1
    python scripts/export_all_protocols_xlsx.py --laboratory-id 1 --department-id 2
    python scripts/export_all_protocols_xlsx.py --only-with-deleted-methods

Фильтры (опционально):
    --laboratory-id            только протоколы этой лаборатории (все подразделения)
    --department-id            сузить до подразделения (обычно вместе с --laboratory-id)
    --only-with-deleted-methods  только протоколы, где хотя бы один расчёт
                                 связан с удалённым методом исследования
"""

import argparse
import asyncio
from collections import defaultdict
from copy import copy
from io import BytesIO
from pathlib import Path
import re
import sys
from typing import Any
from fastapi import HTTPException
from loguru import logger
from openpyxl import Workbook, load_workbook
import pendulum
from sqlalchemy import select

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from core.config import settings  # noqa: E402
from core.database import AsyncSessionLocal  # noqa: E402
from core.http_clients import get_hr_client  # noqa: E402
from models.calculation import Calculation  # noqa: E402
from models.protocol import Protocol  # noqa: E402
from models.research import ResearchMethod  # noqa: E402
import services.employees as employees_module  # noqa: E402
from services.employees import get_employees_by_hsnils  # noqa: E402
import services.protocol_generator as protocol_generator_module  # noqa: E402
from services.protocol_generator import generate_protocol_excel  # noqa: E402
from utils.date import ensure_datetime, parse_datetime_string  # noqa: E402

INVALID_SHEET_NAME_CHARS = re.compile(r"[\\/*?\[\]:]")
MAX_SHEET_NAME_LEN = 31
HR_BATCH_SIZE = 200

_employees_by_hsnils_store: dict[str, dict] = {}
_hr_cache_installed = False


def resolve_protocol_target_date(protocol: Protocol):
    """Дата протокола для запроса должности сотрудника в HR."""
    target_date = protocol.test_protocol_date or protocol.created_at
    if isinstance(target_date, str):
        return pendulum.parse(target_date).date()
    if hasattr(target_date, "date"):
        return target_date.date()
    return target_date


async def _cached_get_employees_by_hsnils(hsnils_list: list[str], include_photo: bool = False) -> dict[str, dict]:
    """Вернуть сотрудников из предзагруженного кэша без повторных запросов к HR."""
    del include_photo
    unique_hsnils = [h for h in dict.fromkeys(hsnils_list) if h]
    return {h: _employees_by_hsnils_store[h] for h in unique_hsnils if h in _employees_by_hsnils_store}


def install_hr_employees_cache() -> None:
    """Подменить get_employees_by_hsnils в модулях, где функция уже импортирована."""
    global _hr_cache_installed
    employees_module.get_employees_by_hsnils = _cached_get_employees_by_hsnils
    protocol_generator_module.get_employees_by_hsnils = _cached_get_employees_by_hsnils
    _hr_cache_installed = True


def restore_hr_employees_cache() -> None:
    """Вернуть оригинальный get_employees_by_hsnils после экспорта."""
    global _hr_cache_installed
    if not _hr_cache_installed:
        return

    employees_module.get_employees_by_hsnils = get_employees_by_hsnils
    protocol_generator_module.get_employees_by_hsnils = get_employees_by_hsnils
    _hr_cache_installed = False


def _merge_employee_records(result: dict[str, dict[str, Any]], employee: dict[str, Any]) -> None:
    """Выбрать актуальную запись сотрудника при дубликатах hashMd5."""
    hash_md5 = employee.get("hashMd5")
    if not hash_md5:
        return

    if hash_md5 in result:
        current_status = result[hash_md5].get("workingNowStatus")
        new_status = employee.get("workingNowStatus")
        if new_status == "Работает" and current_status != "Работает":
            result[hash_md5] = employee
    else:
        result[hash_md5] = employee


async def fetch_employees_by_hashes_post(
    hashes_md5: list[str],
) -> dict[str, dict[str, Any]]:
    """Один POST-батч в HR API с appointments для всех hashMd5."""
    if not hashes_md5:
        return {}

    if not settings.HR_API_URL:
        raise ValueError("HR_API_URL не настроен")

    url = f"{settings.HR_API_URL}/api/v2/employee/by-hashes/"
    payload = {
        "hashesMd5": hashes_md5,
        "includeExtended": False,
        "includePhoto": False,
        "includeExp": False,
        "includeDismissed": True,
        "includeAppointments": True,
    }

    client = await get_hr_client()
    response = await client.post(url, headers={"Content-Type": "application/json"}, json=payload)

    if response.status_code == 404:
        return {}

    response.raise_for_status()
    employees_data = response.json()

    result: dict[str, dict[str, Any]] = {}
    if isinstance(employees_data, list):
        for employee in employees_data:
            if isinstance(employee, dict):
                _merge_employee_records(result, employee)

    return result


def format_employee_name(full_name: str) -> str:
    """Форматировать ФИО как в get_employee_position_and_name."""
    if not full_name:
        return ""

    name_parts = full_name.split()
    if len(name_parts) >= 3:
        surname = name_parts[0]
        first_name = name_parts[1][0] + "." if name_parts[1] else ""
        middle_name = name_parts[2][0] + "." if len(name_parts) > 2 and name_parts[2] else ""
        return f"{first_name}{middle_name} {surname}"

    return full_name


def resolve_position_and_name(employee_data: dict[str, Any], target_date) -> tuple[str, str]:
    """Определить должность и имя по данным из POST-батча."""
    full_name = employee_data.get("fullName", "")
    formatted_name = format_employee_name(full_name)
    if not formatted_name:
        return "", ""

    target_datetime = ensure_datetime(target_date)
    if not target_datetime:
        return "", formatted_name

    appointments = employee_data.get("employeeAppointments", [])
    if not appointments:
        return "", formatted_name

    target_position = ""
    best_appointment = None

    for appointment in appointments:
        position_name = appointment.get("positionName", "")
        begin_date_str = appointment.get("beginDate", "")
        end_date_str = appointment.get("endDate", "")

        if not begin_date_str:
            continue

        try:
            begin_datetime = ensure_datetime(parse_datetime_string(begin_date_str))
            end_datetime = ensure_datetime(parse_datetime_string(end_date_str)) if end_date_str else None

            if not begin_datetime:
                continue

            appointment_fits = False
            if end_datetime:
                appointment_fits = begin_datetime <= target_datetime <= end_datetime
            else:
                appointment_fits = begin_datetime <= target_datetime

            if appointment_fits:
                if not best_appointment:
                    best_appointment = appointment
                    target_position = position_name
                else:
                    best_begin_datetime = ensure_datetime(parse_datetime_string(best_appointment.get("beginDate", "")))
                    if best_begin_datetime and begin_datetime > best_begin_datetime:
                        best_appointment = appointment
                        target_position = position_name
        except Exception as exc:
            logger.warning(
                f"Ошибка парсинга даты назначения для hash={employee_data.get('hashMd5')}: "
                f"{exc}, дата: {begin_date_str}"
            )

    return target_position, formatted_name


def warm_position_cache(position_keys: set[tuple[str, object]]) -> None:
    """Заполнить _position_cache без отдельных GET-запросов к HR."""
    for hsnils, target_date in position_keys:
        target_datetime = ensure_datetime(target_date)
        if not target_datetime:
            continue

        employee_data = _employees_by_hsnils_store.get(hsnils)
        if employee_data:
            result = resolve_position_and_name(employee_data, target_date)
        else:
            result = ("", "")

        cache_key = f"position_{hsnils}_{target_datetime.strftime('%Y-%m-%d')}"
        employees_module._position_cache[cache_key] = result


async def prefetch_hr_for_protocols(db, protocols: list[Protocol]) -> None:
    """Один раз загрузить всех сотрудников и должности, нужные для экспорта."""
    _employees_by_hsnils_store.clear()

    all_hashes: set[str] = set()
    position_keys: set[tuple[str, object]] = set()
    sample_protocol_map: dict[int, list[Protocol]] = defaultdict(list)

    for protocol in protocols:
        target_date = resolve_protocol_target_date(protocol)
        if protocol.issued and not protocol.issued_position:
            all_hashes.add(protocol.issued)
            position_keys.add((protocol.issued, target_date))
        if protocol.approved and not protocol.approved_position:
            all_hashes.add(protocol.approved)
            position_keys.add((protocol.approved, target_date))
        for sample_id in protocol.samples or []:
            sample_protocol_map[sample_id].append(protocol)

    sample_ids = list(sample_protocol_map.keys())
    if sample_ids:
        calc_query = (
            select(Calculation.executor, Calculation.sample_id)
            .where(Calculation.sample_id.in_(sample_ids))
            .where(Calculation.deleted_at.is_(None))
            .where(Calculation.executor.isnot(None))
        )
        calc_result = await db.execute(calc_query)
        for executor, sample_id in calc_result.all():
            for protocol in sample_protocol_map.get(sample_id, []):
                all_hashes.add(executor)
                position_keys.add((executor, resolve_protocol_target_date(protocol)))

    if not all_hashes:
        logger.info("HR: сотрудники в протоколах не найдены")
        return

    logger.info(f"HR: POST-батч для {len(all_hashes)} сотрудников, {len(position_keys)} пар (hash, дата)")

    hash_list = list(all_hashes)
    for offset in range(0, len(hash_list), HR_BATCH_SIZE):
        chunk = hash_list[offset : offset + HR_BATCH_SIZE]
        fetched = await fetch_employees_by_hashes_post(chunk)
        _employees_by_hsnils_store.update(fetched)

    warm_position_cache(position_keys)
    install_hr_employees_cache()
    logger.info(
        f"HR: кэш готов ({len(_employees_by_hsnils_store)} сотрудников, "
        f"{len(position_keys)} должностей, только POST-батчи)"
    )


def copy_worksheet(source_ws, target_wb, sheet_title: str):
    """Скопировать лист протокола в общую книгу с сохранением оформления."""
    target_ws = target_wb.create_sheet(title=sheet_title)

    for row in source_ws.iter_rows():
        for cell in row:
            target_cell = target_ws.cell(row=cell.row, column=cell.column, value=cell.value)
            if cell.has_style:
                target_cell.font = copy(cell.font)
                target_cell.border = copy(cell.border)
                target_cell.fill = copy(cell.fill)
                target_cell.number_format = cell.number_format
                target_cell.protection = copy(cell.protection)
                target_cell.alignment = copy(cell.alignment)

    for col_letter, col_dim in source_ws.column_dimensions.items():
        target_col = target_ws.column_dimensions[col_letter]
        target_col.width = col_dim.width
        target_col.hidden = col_dim.hidden

    for row_idx, row_dim in source_ws.row_dimensions.items():
        target_row = target_ws.row_dimensions[row_idx]
        target_row.height = row_dim.height
        target_row.hidden = row_dim.hidden

    for merged_range in list(source_ws.merged_cells.ranges):
        target_ws.merge_cells(str(merged_range))

    target_ws.page_setup = copy(source_ws.page_setup)
    target_ws.page_margins = copy(source_ws.page_margins)
    target_ws.print_options = copy(source_ws.print_options)
    target_ws.sheet_format = copy(source_ws.sheet_format)
    target_ws.sheet_properties = copy(source_ws.sheet_properties)

    for footer_attr in (
        "oddHeader",
        "oddFooter",
        "evenHeader",
        "evenFooter",
        "firstHeader",
        "firstFooter",
    ):
        if hasattr(source_ws, footer_attr) and hasattr(target_ws, footer_attr):
            setattr(target_ws, footer_attr, copy(getattr(source_ws, footer_attr)))

    return target_ws


def build_sheet_title(protocol: Protocol, used_titles: set[str]) -> str:
    """Собрать уникальное имя листа Excel для протокола."""
    number = (protocol.test_protocol_number or str(protocol.id)).strip()
    number = INVALID_SHEET_NAME_CHARS.sub("_", number)
    number = re.sub(r"\s+", "_", number)
    base = f"{protocol.id}_{number}"[:MAX_SHEET_NAME_LEN]
    if not base:
        base = f"protocol_{protocol.id}"[:MAX_SHEET_NAME_LEN]

    title = base
    suffix = 2
    while title in used_titles:
        tail = f"_{suffix}"
        title = f"{base[: MAX_SHEET_NAME_LEN - len(tail)]}{tail}"
        suffix += 1

    used_titles.add(title)
    return title


async def filter_protocols_with_deleted_methods(db, protocols: list[Protocol]) -> list[Protocol]:
    """Оставить протоколы, у которых есть расчёт с удалённым методом исследования."""
    if not protocols:
        return []

    sample_to_protocol_ids: dict[int, list[int]] = defaultdict(list)
    all_sample_ids: set[int] = set()

    for protocol in protocols:
        for sample_id in protocol.samples or []:
            all_sample_ids.add(sample_id)
            sample_to_protocol_ids[sample_id].append(protocol.id)

    if not all_sample_ids:
        return []

    query = (
        select(Calculation.sample_id)
        .join(ResearchMethod, Calculation.research_method_id == ResearchMethod.id)
        .where(Calculation.sample_id.in_(all_sample_ids))
        .where(Calculation.deleted_at.is_(None))
        .where(ResearchMethod.deleted_at.isnot(None))
        .distinct()
    )
    result = await db.execute(query)
    samples_with_deleted_method = {row[0] for row in result.all()}

    protocol_ids_with_deleted_method: set[int] = set()
    for sample_id in samples_with_deleted_method:
        protocol_ids_with_deleted_method.update(sample_to_protocol_ids.get(sample_id, []))

    return [protocol for protocol in protocols if protocol.id in protocol_ids_with_deleted_method]


async def export_all_protocols(
    output_path: Path,
    laboratory_id: int | None,
    department_id: int | None,
    only_with_deleted_methods: bool = False,
) -> None:
    """Сгенерировать все неудалённые протоколы в один файл."""
    async with AsyncSessionLocal() as db:
        query = select(Protocol).where(Protocol.deleted_at.is_(None)).order_by(Protocol.id.asc())
        if laboratory_id is not None:
            query = query.where(Protocol.laboratory_id == laboratory_id)
        if department_id is not None:
            query = query.where(Protocol.department_id == department_id)

        result = await db.execute(query)
        protocols = list(result.scalars().all())

        if only_with_deleted_methods:
            total_before = len(protocols)
            protocols = await filter_protocols_with_deleted_methods(db, protocols)
            logger.info(f"Фильтр --only-with-deleted-methods: {len(protocols)} из {total_before} протоколов")

        if not protocols:
            if only_with_deleted_methods:
                logger.warning("Не найдено протоколов с удалёнными методами исследования")
            else:
                logger.warning("Не найдено неудалённых протоколов")
            return

        filter_parts: list[str] = []
        if laboratory_id is not None:
            filter_parts.append(f"лаборатория={laboratory_id}")
        if department_id is not None:
            filter_parts.append(f"подразделение={department_id}")
        if only_with_deleted_methods:
            filter_parts.append("только с удалёнными методами")
        if filter_parts:
            logger.info(f"Фильтр: {', '.join(filter_parts)}")
        else:
            logger.info("Фильтр: все лаборатории и подразделения")

        logger.info(f"Найдено протоколов: {len(protocols)}")

        try:
            await prefetch_hr_for_protocols(db, protocols)

            target_wb = Workbook()
            target_wb.remove(target_wb.active)

            used_titles: set[str] = set()
            success_count = 0
            skipped: list[tuple[int, str]] = []

            for protocol in protocols:
                protocol_label = protocol.test_protocol_number or protocol.id
                try:
                    response = await generate_protocol_excel(db, protocol.id)
                    source_wb = load_workbook(BytesIO(response.body), data_only=False)
                    source_ws = source_wb.active
                    sheet_title = build_sheet_title(protocol, used_titles)
                    copy_worksheet(source_ws, target_wb, sheet_title)
                    source_wb.close()
                    success_count += 1
                    logger.info(f"OK протокол {protocol.id} ({protocol_label}) -> лист «{sheet_title}»")
                except HTTPException as exc:
                    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
                    skipped.append((protocol.id, detail))
                    logger.warning(f"Пропуск протокола {protocol.id} ({protocol_label}): {detail}")
                except Exception as exc:
                    skipped.append((protocol.id, str(exc)))
                    logger.exception(f"Ошибка протокола {protocol.id} ({protocol_label}): {exc}")

            if success_count == 0:
                logger.error("Ни один протокол не сформирован, файл не создан")
                if skipped:
                    logger.error(f"Пропущено протоколов: {len(skipped)}")
                return

            output_path.parent.mkdir(parents=True, exist_ok=True)
            target_wb.save(output_path)
            target_wb.close()

            logger.info(f"Сохранено: {output_path}")
            logger.info(f"Листов: {success_count} из {len(protocols)}")
            if skipped:
                logger.warning(f"Пропущено протоколов: {len(skipped)}")
                for protocol_id, reason in skipped:
                    logger.warning(f"  id={protocol_id}: {reason}")
        finally:
            restore_hr_employees_cache()


def parse_args() -> argparse.Namespace:
    """Разбор аргументов командной строки."""
    parser = argparse.ArgumentParser(description="Экспорт всех неудалённых протоколов в один .xlsx (лист на протокол).")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=BACKEND_DIR / "scripts" / "all_protocols.xlsx",
        help="Путь к результирующему файлу .xlsx",
    )
    parser.add_argument(
        "--laboratory-id",
        type=int,
        default=None,
        metavar="ID",
        help=(
            "ID лаборатории: экспорт протоколов только этой лаборатории "
            "(по всем подразделениям, если --department-id не указан)"
        ),
    )
    parser.add_argument(
        "--department-id",
        type=int,
        default=None,
        metavar="ID",
        help="ID подразделения: дополнительно сузить выборку (обычно вместе с --laboratory-id)",
    )
    parser.add_argument(
        "--only-with-deleted-methods",
        action="store_true",
        help=(
            "Экспортировать только протоколы, у которых хотя бы один неудалённый расчёт "
            "связан с удалённым методом исследования"
        ),
    )
    return parser.parse_args()


def main() -> None:
    """Точка входа."""
    args = parse_args()
    asyncio.run(
        export_all_protocols(
            output_path=args.output.resolve(),
            laboratory_id=args.laboratory_id,
            department_id=args.department_id,
            only_with_deleted_methods=args.only_with_deleted_methods,
        )
    )


if __name__ == "__main__":
    main()
