from __future__ import annotations
from datetime import date, datetime
from typing import Any, cast
from cachetools import TTLCache
import pendulum
from core.exceptions import NotFoundError, ServiceUnavailableError
from core.hr_client import (
    hr_get_employee_by_hsnils,
    hr_get_employees_by_fio,
    hr_post_employees_by_hsnils,
)
from core.logger import logger
from schemas.employee import EmployeeResponse
from utils.date import ensure_datetime, parse_datetime_string
from utils.hr_employee import (
    HR_WORKING_STATUS_ACTIVE,
    format_employee_short_name,
    map_hr_employee_to_app,
    map_hr_employees_list,
    pick_position_on_date,
)

POSITION_CACHE_MAX_SIZE = 512
POSITION_CACHE_TTL_SECONDS = 600

_position_cache = TTLCache[str, tuple[str, str]](
    maxsize=POSITION_CACHE_MAX_SIZE,
    ttl=POSITION_CACHE_TTL_SECONDS,
)


def _as_employee_list(payload: Any) -> list[dict[str, Any]]:
    """Привести ответ HR к списку словарей сотрудников."""
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        return [payload]
    return []


def _to_employee_response(employee: dict[str, Any]) -> EmployeeResponse:
    """Собрать EmployeeResponse из словаря сотрудника HR."""
    return EmployeeResponse.model_validate(employee)


def _to_employee_responses(employees: list[dict[str, Any]]) -> list[EmployeeResponse]:
    """Собрать список EmployeeResponse из словарей HR."""
    return [_to_employee_response(employee) for employee in employees]


def _raise_if_hr_unavailable(status_code: int) -> None:
    """Выбросить ServiceUnavailableError при HTTP-ошибке HR."""
    if status_code >= 400:
        raise ServiceUnavailableError(f"HR API недоступен: HTTP {status_code}")


async def search_employees_by_fio(search_fio: str, include_photo: bool = True) -> list[EmployeeResponse]:
    """Искать сотрудников по части ФИО от трёх символов."""
    if not search_fio or len(search_fio) < 3:
        return []

    status_code, payload = await hr_get_employees_by_fio(
        search_fio,
        include_photo=include_photo,
        records_number=10,
    )
    _raise_if_hr_unavailable(status_code)
    return _to_employee_responses(map_hr_employees_list(_as_employee_list(payload)))


async def search_employees_by_fio_and_laboratory(
    search_fio: str, laboratory_name: str, include_photo: bool = True
) -> list[EmployeeResponse]:
    """Искать сотрудников по ФИО и оставить только тех, кто числится в указанной лаборатории."""
    if not search_fio or len(search_fio) < 3:
        return []

    if not laboratory_name:
        logger.warning("Название лаборатории не указано, возвращаем пустой результат")
        return []

    status_code, payload = await hr_get_employees_by_fio(
        search_fio,
        include_photo=include_photo,
        records_number=100,
    )
    _raise_if_hr_unavailable(status_code)

    filtered_employees: list[dict[str, Any]] = []
    for employee in map_hr_employees_list(_as_employee_list(payload)):
        work_places = employee.get("work_places") or []
        if isinstance(work_places, list) and laboratory_name in work_places:
            filtered_employees.append(employee)

    return _to_employee_responses(filtered_employees)


async def require_employee_by_hsnils(hsnils: str, include_photo: bool = True) -> EmployeeResponse:
    """Вернуть сотрудника по hsnils; если HR не нашёл запись — NotFoundError."""
    if not hsnils:
        raise NotFoundError("Сотрудник не найден")

    status_code, payload = await hr_get_employee_by_hsnils(hsnils, include_photo=include_photo)
    if status_code == 404:
        raise NotFoundError("Сотрудник не найден")
    _raise_if_hr_unavailable(status_code)
    if isinstance(payload, dict):
        return _to_employee_response(map_hr_employee_to_app(payload))
    raise NotFoundError("Сотрудник не найден")


async def get_employees_by_hsnils(hsnils_list: list[str], include_photo: bool = False) -> dict[str, EmployeeResponse]:
    """
    Загрузить сотрудников пакетом по списку hsnils.

    Ответ 404 от HR трактуется как пустой результат, а не ошибка: в пакете часть
    идентификаторов может отсутствовать.
    """
    if not hsnils_list:
        return {}

    status_code, payload = await hr_post_employees_by_hsnils(hsnils_list, include_photo=include_photo)
    if status_code == 404:
        return {}
    _raise_if_hr_unavailable(status_code)

    # В ответе API всегда поле hsnils; при нескольких записях HR предпочитать статус «Работает».
    result: dict[str, dict[str, Any]] = {}
    for employee in map_hr_employees_list(_as_employee_list(payload)):
        hsnils = employee.get("hsnils")
        if not hsnils:
            continue
        if hsnils in result:
            current_status = result[hsnils].get("working_now_status")
            new_status = employee.get("working_now_status")
            if new_status == HR_WORKING_STATUS_ACTIVE and current_status != HR_WORKING_STATUS_ACTIVE:
                result[hsnils] = employee
        else:
            result[hsnils] = employee

    return {key: _to_employee_response(value) for key, value in result.items()}


def _position_cache_key(hsnils: str, target_datetime: pendulum.DateTime) -> str:
    """Собрать ключ кэша должности: position_{hsnils}_{дата}."""
    return f"position_{hsnils}_{target_datetime.strftime('%Y-%m-%d')}"


def build_position_cache_key(hsnils: str, target_datetime: pendulum.DateTime) -> str:
    """Собрать ключ кэша должности для hsnils и даты."""
    return _position_cache_key(hsnils, target_datetime)


def prime_position_cache(entries: dict[str, tuple[str, str]]) -> None:
    """Заполнить кэш должностей ключами position_{hsnils}_{YYYY-MM-DD}."""
    for cache_key, value in entries.items():
        _position_cache[cache_key] = value


def clear_position_cache() -> None:
    """Очистить кэш должностей."""
    _position_cache.clear()


async def get_employee_position_and_name(
    hsnils: str,
    target_date: pendulum.DateTime | datetime | date | str | None,
) -> tuple[str, str]:
    """Вернуть должность и краткое ФИО на дату; при сбое HR — пустые строки."""
    if not hsnils:
        return "", ""

    if isinstance(target_date, str):
        target_datetime = ensure_datetime(parse_datetime_string(target_date))
    else:
        target_datetime = ensure_datetime(target_date)
    if not target_datetime:
        logger.warning("Невозможно преобразовать target_date: {}", target_date)
        return "", ""

    cache_key = _position_cache_key(hsnils, target_datetime)
    cached = _position_cache.get(cache_key)
    if cached is not None:
        return cached

    logger.info("Запрашиваем должность сотрудника на дату {}", target_datetime)

    try:
        status_code, employee_data = await hr_get_employee_by_hsnils(
            hsnils,
            include_photo=None,
            records_number=None,
            include_appointments=True,
        )
        if status_code != 200 or not isinstance(employee_data, dict):
            logger.warning("HR-API вернул статус {} при запросе должности", status_code)
            return "", ""

        mapped = map_hr_employee_to_app(employee_data)
        full_name = str(mapped.get("full_name") or "")
        if not full_name:
            return "", ""

        formatted_name = format_employee_short_name(full_name)
        appointments = mapped.get("appointments") or []
        if not isinstance(appointments, list) or not appointments:
            result = ("", formatted_name)
            _position_cache[cache_key] = result
            return result

        target_position = pick_position_on_date(
            cast(list[dict[str, Any]], appointments),
            target_datetime,
        )
        result = (target_position, formatted_name)
        _position_cache[cache_key] = result
        return result
    except ServiceUnavailableError:
        # Для протоколов без должности/ФИО.
        return "", ""
