from typing import Any, Optional, Tuple
import httpx
import orjson
from cachetools import TTLCache
from core.config import settings
from core.http_clients import get_hr_client
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

_position_cache: TTLCache[str, Tuple[str, str]] = TTLCache(
    maxsize=POSITION_CACHE_MAX_SIZE, ttl=POSITION_CACHE_TTL_SECONDS
)


async def search_employees_by_fio(
    search_fio: str, include_photo: bool = True
) -> list[dict[str, Any]]:
    """Поиск сотрудников по ФИО через HR API."""
    if not search_fio or len(search_fio) < 3:
        return []

    if not settings.HR_API_URL:
        logger.error("HR_API_URL не настроен")
        raise ValueError("HR_API_URL не настроен")

    try:
        url = f"{settings.HR_API_URL}/api/v2/employee/by-fio/{search_fio}?includeDismissed=true&recordsNumber=10&includePhoto={str(include_photo).lower()}"
        headers = {"Content-Type": "application/json"}

        client = await get_hr_client()
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        employees_data = response.json()

        if not isinstance(employees_data, list):
            if isinstance(employees_data, dict):
                employees_data = [employees_data]
            else:
                employees_data = []

        return map_hr_employees_list(employees_data)

    except httpx.RequestError as e:
        logger.error(f"Ошибка при обращении к HR API: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Внутренняя ошибка сервера: {str(e)}")
        raise


async def search_employees_by_fio_and_laboratory(
    search_fio: str, laboratory_name: str, include_photo: bool = True
) -> list[dict[str, Any]]:
    """Поиск сотрудников по ФИО с фильтрацией по лаборатории через HR API."""
    if not search_fio or len(search_fio) < 3:
        return []

    if not laboratory_name:
        logger.warning("Название лаборатории не указано, возвращаем пустой результат")
        return []

    if not settings.HR_API_URL:
        logger.error("HR_API_URL не настроен")
        raise ValueError("HR_API_URL не настроен")

    try:
        url = f"{settings.HR_API_URL}/api/v2/employee/by-fio/{search_fio}?includeDismissed=true&recordsNumber=100&includePhoto={str(include_photo).lower()}"
        headers = {"Content-Type": "application/json"}

        client = await get_hr_client()
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        employees_data = response.json()

        if not isinstance(employees_data, list):
            if isinstance(employees_data, dict):
                employees_data = [employees_data]
            else:
                employees_data = []

        filtered_employees = []
        for employee in employees_data:
            if not employee.get("workPlaceJson"):
                continue

            try:
                work_places = orjson.loads(employee["workPlaceJson"])
                if isinstance(work_places, list) and laboratory_name in work_places:
                    filtered_employees.append(employee)
            except (orjson.JSONDecodeError, TypeError):
                continue

        return map_hr_employees_list(filtered_employees)

    except httpx.RequestError as e:
        logger.error(f"Ошибка при обращении к HR API: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Внутренняя ошибка сервера: {str(e)}")
        raise


async def get_employee_by_hsnils(
    hsnils: str, include_photo: bool = True
) -> Optional[dict[str, Any]]:
    """Получение информации о сотруднике по hsnils через HR API."""
    if not hsnils:
        return None

    if not settings.HR_API_URL:
        logger.error("HR_API_URL не настроен")
        raise ValueError("HR_API_URL не настроен")

    try:
        url = (
            f"{settings.HR_API_URL}/api/v2/employee/by-hash/{hsnils}"
            f"?includeDismissed=true&recordsNumber=1&includePhoto={str(include_photo).lower()}"
        )
        headers = {"Content-Type": "application/json"}

        client = await get_hr_client()
        response = await client.get(url, headers=headers)

        if response.status_code == 404:
            logger.debug(f"Сотрудник с hsnils={hsnils} не найден в HR API (404)")
            return None

        response.raise_for_status()
        employee_data = response.json()

        if isinstance(employee_data, dict):
            return map_hr_employee_to_app(employee_data)
        return employee_data

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            logger.debug(f"Сотрудник с hsnils={hsnils} не найден в HR API (404)")
            return None
        logger.error(f"Ошибка HTTP при обращении к HR API: {str(e)}")
        raise
    except httpx.RequestError as e:
        logger.error(f"Ошибка при обращении к HR API: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Внутренняя ошибка сервера: {str(e)}")
        raise


async def get_employees_by_hsnils(
    hsnils_list: list[str], include_photo: bool = False
) -> dict[str, dict[str, Any]]:
    """Получение информации о сотрудниках по списку hsnils через HR API (батч-запрос)."""
    if not hsnils_list:
        return {}

    if not settings.HR_API_URL:
        logger.error("HR_API_URL не настроен")
        raise ValueError("HR_API_URL не настроен")

    try:
        url = f"{settings.HR_API_URL}/api/v2/employee/by-hashes/"
        headers = {"Content-Type": "application/json"}
        payload = {
            "hashesMd5": hsnils_list,
            "includeExtended": False,
            "includePhoto": include_photo,
            "includeExp": False,
            "includeDismissed": True,
            "includeAppointments": False,
        }

        client = await get_hr_client()
        response = await client.post(url, headers=headers, json=payload)

        if response.status_code == 404:
            logger.debug("Сотрудники с указанными hsnils не найдены в HR API (404)")
            return {}

        response.raise_for_status()
        employees_data = response.json()

        result: dict[str, dict[str, Any]] = {}
        if isinstance(employees_data, list):
            for employee in employees_data:
                if isinstance(employee, dict) and HR_HASH_MD5_FIELD in employee:
                    hr_hash = employee.get(HR_HASH_MD5_FIELD)
                    if hr_hash:
                        if hr_hash in result:
                            current_status = result[hr_hash].get("workingNowStatus")
                            new_status = employee.get("workingNowStatus")

                            if (
                                new_status == "Работает"
                                and current_status != "Работает"
                            ):
                                result[hr_hash] = employee
                        else:
                            result[hr_hash] = employee

        return map_hr_employees_by_key(result)

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            logger.debug("Сотрудники с указанными hsnils не найдены в HR API (404)")
            return {}
        logger.error(f"Ошибка HTTP при обращении к HR API: {str(e)}")
        raise
    except httpx.RequestError as e:
        logger.error(f"Ошибка при обращении к HR API: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Внутренняя ошибка сервера: {str(e)}")
        raise


async def get_employee_position_and_name(hsnils: str, target_date) -> Tuple[str, str]:
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

    logger.info(
        f"Запрашиваем должность сотрудника по hsnils {hsnils} на дату {target_datetime}"
    )

    try:
        client = await get_hr_client()
        url = (
            f"{settings.HR_API_URL}/api/v2/employee/by-hash/{hsnils}"
            "?includeDismissed=True&includeAppointments=True"
        )

        response = await client.get(url, timeout=10.0)
        if response.status_code != 200:
            logger.warning(
                "HR-API вернул статус %s для hsnils %s: %s",
                response.status_code,
                hsnils,
                response.text,
            )
            return "", ""

        employee_data = response.json()
        full_name = employee_data.get("fullName", "")
        if not full_name:
            return "", ""

        name_parts = full_name.split()
        if len(name_parts) >= 3:
            surname = name_parts[0]
            first_name = name_parts[1][0] + "." if name_parts[1] else ""
            middle_name = (
                name_parts[2][0] + "." if len(name_parts) > 2 and name_parts[2] else ""
            )
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
                end_datetime = (
                    ensure_datetime(parse_datetime_string(end_date_str))
                    if end_date_str
                    else None
                )

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
                logger.warning(
                    f"Ошибка парсинга даты для hsnils={hsnils}: {e}, дата: {begin_date_str}"
                )
                continue

        result = (target_position, formatted_name)
        _position_cache[cache_key] = result
        return result

    except httpx.RequestError as e:
        logger.error(f"Ошибка запроса HR-API для hsnils {hsnils}: {e}")
    except Exception as e:
        logger.exception("Ошибка запроса HR-API для hsnils %s: %s", hsnils, e)
    return "", ""
