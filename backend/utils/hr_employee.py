from __future__ import annotations
from typing import Any
import orjson
import pendulum
from utils.date import ensure_datetime, parse_datetime_string

HR_HASH_MD5_FIELD = "hashMd5"
HR_WORKING_STATUS_ACTIVE = "Работает"


def _parse_work_places(raw: Any) -> list[Any]:
    """Разобрать workPlaceJson HR в список мест работы."""
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = orjson.loads(raw)
            return parsed if isinstance(parsed, list) else []
        except (orjson.JSONDecodeError, TypeError):
            return []
    return []


def map_hr_appointment_to_app(appointment: dict[str, Any]) -> dict[str, Any]:
    """Переводит назначение HR в поля приложения."""
    return {
        "position_name": appointment.get("positionName") or "",
        "begin_date": appointment.get("beginDate") or "",
        "end_date": appointment.get("endDate") or "",
    }


def map_hr_employee_to_app(employee: dict[str, Any]) -> dict[str, Any]:
    """Переводит ответ HR в поля приложения: hashMd5 → hsnils и известные camelCase-поля."""
    mapped = dict(employee)
    if HR_HASH_MD5_FIELD in mapped:
        mapped["hsnils"] = mapped.pop(HR_HASH_MD5_FIELD)
    if "fullName" in mapped:
        mapped["full_name"] = mapped.pop("fullName")
    if "workPlaceJson" in mapped:
        mapped["work_places"] = _parse_work_places(mapped.pop("workPlaceJson"))
    if "workingNowStatus" in mapped:
        mapped["working_now_status"] = mapped.pop("workingNowStatus")
    if "employeeAppointments" in mapped:
        raw_appointments = mapped.pop("employeeAppointments") or []
        mapped["appointments"] = [
            map_hr_appointment_to_app(item) for item in raw_appointments if isinstance(item, dict)
        ]
    return mapped


def map_hr_employees_list(employees: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Перевести список сотрудников HR в поля приложения."""
    return [map_hr_employee_to_app(employee) for employee in employees if isinstance(employee, dict)]


def map_hr_employees_by_key(
    employees: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Перевести словарь сотрудников HR; ключ — hsnils."""
    mapped: dict[str, dict[str, Any]] = {}
    for key, employee in employees.items():
        if not isinstance(employee, dict):
            continue
        mapped_employee = map_hr_employee_to_app(employee)
        hsnils = mapped_employee.get("hsnils") or key
        mapped[hsnils] = mapped_employee
    return mapped


def format_employee_short_name(full_name: str) -> str:
    """Сокращает ФИО до вида «И.О. Фамилия»."""
    name_parts = full_name.split()
    if len(name_parts) < 3:
        return full_name
    surname = name_parts[0]
    first_initial = f"{name_parts[1][0]}." if name_parts[1] else ""
    middle_initial = f"{name_parts[2][0]}." if name_parts[2] else ""
    return f"{first_initial}{middle_initial} {surname}"


def pick_position_on_date(
    appointments: list[dict[str, Any]],
    target_datetime: pendulum.DateTime,
) -> str:
    """Выбирает должность, действовавшую на указанную дату (при пересечении — с более поздним началом)."""
    target_position = ""
    best_begin: pendulum.DateTime | None = None

    for appointment in appointments:
        if not isinstance(appointment, dict):
            continue
        position_name = str(appointment.get("position_name") or "")
        begin_date_str = str(appointment.get("begin_date") or "")
        end_date_str = str(appointment.get("end_date") or "")
        if not begin_date_str:
            continue

        begin_datetime = ensure_datetime(parse_datetime_string(begin_date_str))
        if not begin_datetime:
            continue
        end_datetime = ensure_datetime(parse_datetime_string(end_date_str)) if end_date_str else None

        if end_datetime is not None:
            fits = begin_datetime <= target_datetime <= end_datetime
        else:
            fits = begin_datetime <= target_datetime
        if not fits:
            continue

        if best_begin is None or begin_datetime > best_begin:
            best_begin = begin_datetime
            target_position = position_name

    return target_position
