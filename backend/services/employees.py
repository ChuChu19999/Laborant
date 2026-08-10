from __future__ import annotations
from typing import Any
from urllib.parse import quote
from cachetools import TTLCache
import orjson
from core.exceptions import NotFoundError, ServiceUnavailableError
from core.hr_client import hr_request_json
from core.logger import logger
from utils.date import ensure_datetime, parse_datetime_string
from utils.hr_employee import (
    HR_HASH_MD5_FIELD,
    map_hr_employee_to_app,
    map_hr_employees_by_key,
    map_hr_employees_list,
)

POSITION_CACHE_MAX_SIZE = 512
POSITION_CACHE_TTL_SECONDS = 600

_position_cache: TTLCache[str, tuple[str, str]] = TTLCache(
    maxsize=POSITION_CACHE_MAX_SIZE, ttl=POSITION_CACHE_TTL_SECONDS
)


def _fio_path(search_fio: str) -> str:
    return f"/api/v2/employee/by-fio/{quote(search_fio, safe='')}"


def _hash_path(hsnils: str) -> str:
    return f"/api/v2/employee/by-hash/{quote(hsnils, safe='')}"


def _as_employee_list(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        return [payload]
    return []


async def search_employees_by_fio(search_fio: str, include_photo: bool = True) -> list[dict[str, Any]]:
    """Поиск сотрудников по ФИО через HR API."""
    if not search_fio or len(search_fio) < 3:
        return []

    status_code, payload = await hr_request_json(
        "GET",
        _fio_path(search_fio),
        params={
            "includeDismissed": "true",
            "recordsNumber": 10,
            "includePhoto": str(include_photo).lower(),
        },
    )
    if status_code >= 400:
        raise ServiceUnavailableError(f"HR API недоступен: HTTP {status_code}")
    return map_hr_employees_list(_as_employee_list(payload))


async def search_employees_by_fio_and_laboratory(
    search_fio: str, laboratory_name: str, include_photo: bool = True
) -> list[dict[str, Any]]:
    """Поиск сотрудников по ФИО с фильтрацией по лаборатории через HR API."""
    if not search_fio or len(search_fio) < 3:
        return []

    if not laboratory_name:
        logger.warning("Название лаборатории не указано, возвращаем пустой результат")
        return []

    status_code, payload = await hr_request_json(
        "GET",
        _fio_path(search_fio),
        params={
            "includeDismissed": "true",
            "recordsNumber": 100,
            "includePhoto": str(include_photo).lower(),
        },
    )
    if status_code >= 400:
        raise ServiceUnavailableError(f"HR API недоступен: HTTP {status_code}")

    filtered_employees: list[dict[str, Any]] = []
    for employee in _as_employee_list(payload):
        if not employee.get("workPlaceJson"):
            continue
        try:
            work_places = orjson.loads(employee["workPlaceJson"])
            if isinstance(work_places, list) and laboratory_name in work_places:
                filtered_employees.append(employee)
        except (orjson.JSONDecodeError, TypeError):
            continue

    return map_hr_employees_list(filtered_employees)


async def get_employee_by_hsnils(hsnils: str, include_photo: bool = True) -> dict[str, Any] | None:
    """Получение информации о сотруднике по hsnils через HR API."""
    if not hsnils:
        return None

    status_code, payload = await hr_request_json(
        "GET",
        _hash_path(hsnils),
        params={
            "includeDismissed": "true",
            "recordsNumber": 1,
            "includePhoto": str(include_photo).lower(),
        },
    )
    if status_code == 404:
        raise NotFoundError("Сотрудник не найден")
    if status_code >= 400:
        raise ServiceUnavailableError(f"HR API недоступен: HTTP {status_code}")
    if isinstance(payload, dict):
        return map_hr_employee_to_app(payload)
    raise NotFoundError("Сотрудник не найден")


async def get_employees_by_hsnils(hsnils_list: list[str], include_photo: bool = False) -> dict[str, dict[str, Any]]:
    """Получение информации о сотрудниках по списку hsnils через HR API (батч)."""
    if not hsnils_list:
        return {}

    status_code, payload = await hr_request_json(
        "POST",
        "/api/v2/employee/by-hashes/",
        json_body={
            "hashesMd5": hsnils_list,
            "includeExtended": False,
            "includePhoto": include_photo,
            "includeExp": False,
            "includeDismissed": True,
            "includeAppointments": False,
        },
    )
    if status_code == 404:
        return {}
    if status_code >= 400:
        raise ServiceUnavailableError(f"HR API недоступен: HTTP {status_code}")

    result: dict[str, dict[str, Any]] = {}
    for employee in _as_employee_list(payload):
        if HR_HASH_MD5_FIELD not in employee:
            continue
        hr_hash = employee.get(HR_HASH_MD5_FIELD)
        if not hr_hash:
            continue
        if hr_hash in result:
            current_status = result[hr_hash].get("workingNowStatus")
            new_status = employee.get("workingNowStatus")
            if new_status == "Работает" and current_status != "Работает":
                result[hr_hash] = employee
        else:
            result[hr_hash] = employee

    # Наружу приложения всегда hsnils, не hashMd5.
    return map_hr_employees_by_key(result)


async def get_employee_position_and_name(hsnils: str, target_date) -> tuple[str, str]:
    """Возвращает должность и имя сотрудника по hsnils на указанную дату."""
    if not hsnils:
        return "", ""

    target_datetime = ensure_datetime(target_date)
    if not target_datetime:
        logger.warning(f"Невозможно преобразовать target_date: {target_date}")
        return "", ""

    cache_key = f"position_{hsnils}_{target_datetime.strftime('%Y-%m-%d')}"
    if cache_key in _position_cache:
        return _position_cache[cache_key]

    logger.info(f"Запрашиваем должность сотрудника по hsnils {hsnils} на дату {target_datetime}")

    try:
        status_code, employee_data = await hr_request_json(
            "GET",
            _hash_path(hsnils),
            params={
                "includeDismissed": "True",
                "includeAppointments": "True",
            },
        )
        if status_code != 200 or not isinstance(employee_data, dict):
            logger.warning(
                "HR-API вернул статус %s для hsnils %s",
                status_code,
                hsnils,
            )
            return "", ""

        full_name = employee_data.get("fullName", "")
        if not full_name:
            return "", ""

        name_parts = full_name.split()
        if len(name_parts) >= 3:
            surname = name_parts[0]
            first_name = name_parts[1][0] + "." if name_parts[1] else ""
            middle_name = name_parts[2][0] + "." if len(name_parts) > 2 and name_parts[2] else ""
            formatted_name = f"{first_name}{middle_name} {surname}"
        else:
            formatted_name = full_name

        appointments = employee_data.get("employeeAppointments", [])
        if not appointments:
            result = ("", formatted_name)
            _position_cache[cache_key] = result
            return result

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
                    if begin_datetime <= target_datetime <= end_datetime:
                        appointment_fits = True
                else:
                    if begin_datetime <= target_datetime:
                        appointment_fits = True

                if appointment_fits:
                    if not best_appointment:
                        best_appointment = appointment
                        target_position = position_name
                    else:
                        best_begin_datetime = ensure_datetime(
                            parse_datetime_string(best_appointment.get("beginDate", ""))
                        )
                        if best_begin_datetime and begin_datetime > best_begin_datetime:
                            best_appointment = appointment
                            target_position = position_name

            except Exception as e:
                logger.warning(f"Ошибка парсинга даты для hsnils={hsnils}: {e}, дата: {begin_date_str}")
                continue

        result = (target_position, formatted_name)
        _position_cache[cache_key] = result
        return result

    except ServiceUnavailableError:
        # Для протоколов мягкая деградация: без должности/ФИО.
        return "", ""
    except Exception as e:
        logger.exception("Ошибка запроса HR-API для hsnils %s: %s", hsnils, e)
    return "", ""
