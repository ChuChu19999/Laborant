from typing import Any, Optional, Tuple
import httpx
import orjson
from cachetools import TTLCache
from core.config import settings
from core.http_clients import get_hr_client
from core.logger import logger
from utils.date import ensure_datetime, parse_date_string

CACHE_MAX_SIZE = 1000
CACHE_TTL_SECONDS = 600

_cache: TTLCache[str, Any] = TTLCache(maxsize=CACHE_MAX_SIZE, ttl=CACHE_TTL_SECONDS)

# Кэш для должностей и имен сотрудников
POSITION_CACHE_MAX_SIZE = 512
POSITION_CACHE_TTL_SECONDS = 600

_position_cache: TTLCache[str, Tuple[str, str]] = TTLCache(
    maxsize=POSITION_CACHE_MAX_SIZE, ttl=POSITION_CACHE_TTL_SECONDS
)


async def search_employees_by_fio(
    search_fio: str, include_photo: bool = True
) -> list[dict[str, Any]]:
    """
    Поиск сотрудников по ФИО через HR API.

    Выполняет поиск сотрудников в HR API по части ФИО.
    Минимальная длина поискового запроса - 3 символа.
    Возвращает список найденных сотрудников с их данными.
    """
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

        return employees_data

    except httpx.RequestError as e:
        logger.error(f"Ошибка при обращении к HR API: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Внутренняя ошибка сервера: {str(e)}")
        raise


async def search_employees_by_fio_and_laboratory(
    search_fio: str, laboratory_name: str, include_photo: bool = True
) -> list[dict[str, Any]]:
    """
    Поиск сотрудников по ФИО с фильтрацией по наименованию лаборатории через HR API.

    Выполняет поиск сотрудников в HR API по части ФИО и фильтрует результаты
    по наименованию лаборатории на основе поля workPlaceJson.
    Минимальная длина поискового запроса - 3 символа.
    Возвращает список найденных сотрудников с их данными.
    """
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

        # Фильтруем сотрудников по наименованию лаборатории
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

        return filtered_employees

    except httpx.RequestError as e:
        logger.error(f"Ошибка при обращении к HR API: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Внутренняя ошибка сервера: {str(e)}")
        raise


async def get_employee_by_hash(
    hash_md5: str, include_photo: bool = True
) -> Optional[dict[str, Any]]:
    """
    Получение информации о сотруднике по hashMd5 через HR API.
    Возвращает None, если сотрудник не найден (404) или произошла ошибка.

    Возвращает полную информацию о сотруднике по его hashMd5 (MD5 хэш СНИЛС).
    Данные получаются из HR API и могут включать фотографию сотрудника.
    Результаты кэшируются для оптимизации повторных запросов.
    """
    if not hash_md5:
        return None

    cache_key = f"hr_employee_{hash_md5}_photo_{include_photo}"
    if cache_key in _cache:
        return _cache[cache_key]

    if not settings.HR_API_URL:
        logger.error("HR_API_URL не настроен")
        raise ValueError("HR_API_URL не настроен")

    try:
        url = f"{settings.HR_API_URL}/api/v2/employee/by-hash/{hash_md5}?includeDismissed=true&recordsNumber=1&includePhoto={str(include_photo).lower()}"
        headers = {"Content-Type": "application/json"}

        client = await get_hr_client()
        response = await client.get(url, headers=headers)

        if response.status_code == 404:
            logger.debug(f"Сотрудник с hash_md5={hash_md5} не найден в HR API (404)")
            _cache[cache_key] = None
            return None

        response.raise_for_status()
        employee_data = response.json()

        _cache[cache_key] = employee_data
        return employee_data

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            logger.debug(f"Сотрудник с hash_md5={hash_md5} не найден в HR API (404)")
            _cache[cache_key] = None
            return None
        logger.error(f"Ошибка HTTP при обращении к HR API: {str(e)}")
        raise
    except httpx.RequestError as e:
        logger.error(f"Ошибка при обращении к HR API: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Внутренняя ошибка сервера: {str(e)}")
        raise


async def get_employees_by_hashes(
    hashes_md5: list[str], include_photo: bool = False
) -> dict[str, dict[str, Any]]:
    """
    Получение информации о сотрудниках по массиву hashMd5 через HR API (батч-запрос).
    Возвращает словарь только с найденными сотрудниками. Отсутствующие в HR API игнорируются.

    Возвращает информацию о нескольких сотрудниках по массиву hashMd5 одним запросом.
    Полезно для получения данных о множестве сотрудников одновременно.
    Если массив пуст, возвращается пустой словарь.
    Результаты кэшируются для оптимизации повторных запросов.
    """
    if not hashes_md5 or len(hashes_md5) == 0:
        return {}

    if not settings.HR_API_URL:
        logger.error("HR_API_URL не настроен")
        raise ValueError("HR_API_URL не настроен")

    try:
        url = f"{settings.HR_API_URL}/api/v2/employee/by-hashes/"
        headers = {"Content-Type": "application/json"}
        payload = {
            "hashesMd5": hashes_md5,
            "includeExtended": False,
            "includePhoto": include_photo,
            "includeExp": False,
            "includeDismissed": True,
            "includeAppointments": False,
        }

        client = await get_hr_client()
        response = await client.post(url, headers=headers, json=payload)

        if response.status_code == 404:
            logger.debug(f"Сотрудники с указанными hash_md5 не найдены в HR API (404)")
            return {}

        response.raise_for_status()
        employees_data = response.json()

        result = {}
        if isinstance(employees_data, list):
            for employee in employees_data:
                if isinstance(employee, dict) and "hashMd5" in employee:
                    hash_md5 = employee.get("hashMd5")
                    if hash_md5:
                        result[hash_md5] = employee
                        cache_key = f"hr_employee_{hash_md5}_photo_{include_photo}"
                        _cache[cache_key] = employee

        return result

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            logger.debug(f"Сотрудники с указанными hash_md5 не найдены в HR API (404)")
            return {}
        logger.error(f"Ошибка HTTP при обращении к HR API: {str(e)}")
        raise
    except httpx.RequestError as e:
        logger.error(f"Ошибка при обращении к HR API: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Внутренняя ошибка сервера: {str(e)}")
        raise


async def get_employee_position_and_name(hash_md5: str, target_date) -> Tuple[str, str]:
    """
    Возвращает должность и отформатированное имя сотрудника по hashMd5 на указанную дату.

    Получает информацию о сотруднике из HR API и определяет его должность на указанную дату
    на основе истории назначений. Форматирует имя в формате "И.О. Фамилия".
    Результаты кэшируются для оптимизации повторных запросов.
    """
    if not hash_md5:
        return "", ""

    target_datetime = ensure_datetime(target_date)
    if not target_datetime:
        logger.warning(f"Невозможно преобразовать target_date: {target_date}")
        return "", ""

    # Проверяем кэш
    cache_key = f"position_{hash_md5}_{target_datetime.strftime('%Y-%m-%d')}"
    if cache_key in _position_cache:
        return _position_cache[cache_key]

    logger.info(
        f"Запрашиваем должность сотрудника по hash {hash_md5} на дату {target_datetime}"
    )

    try:
        client = await get_hr_client()
        url = f"{settings.HR_API_URL}/api/v2/employee/by-hash/{hash_md5}?includeDismissed=True&includeAppointments=True"

        response = await client.get(url, timeout=10.0)
        if response.status_code != 200:
            logger.warning(
                "HR-API вернул статус %s для hash %s: %s",
                response.status_code,
                hash_md5,
                response.text,
            )
            return "", ""

        employee_data = response.json()
        full_name = employee_data.get("fullName", "")
        if not full_name:
            return "", ""

        # Форматируем имя: И.О. Фамилия
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
                begin_datetime = ensure_datetime(parse_date_string(begin_date_str))
                end_datetime = (
                    ensure_datetime(parse_date_string(end_date_str))
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
                            parse_date_string(best_appointment.get("beginDate", ""))
                        )
                        if best_begin_datetime and begin_datetime > best_begin_datetime:
                            best_appointment = appointment
                            target_position = position_name

            except Exception as e:
                logger.warning(
                    f"Ошибка парсинга даты для hash={hash_md5}: {e}, дата: {begin_date_str}"
                )
                continue

        logger.info(
            "Получена должность сотрудника: hash=%s → '%s' на дату %s",
            hash_md5,
            target_position,
            target_datetime.strftime("%d.%m.%Y"),
        )

        result = (target_position, formatted_name)
        _position_cache[cache_key] = result
        return result

    except httpx.RequestError as e:
        logger.error(f"Ошибка запроса HR-API для hash {hash_md5}: {e}")
    except Exception as e:
        logger.exception("Ошибка запроса HR-API для hash %s: %s", hash_md5, e)
    return "", ""
