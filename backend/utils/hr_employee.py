from __future__ import annotations
from typing import Any

HR_HASH_MD5_FIELD = "hashMd5"


def map_hr_employee_to_app(employee: dict[str, Any]) -> dict[str, Any]:
    """Преобразует ответ HR API: поле hashMd5 становится hsnils."""
    if HR_HASH_MD5_FIELD not in employee:
        return employee
    mapped = dict(employee)
    mapped["hsnils"] = mapped.pop(HR_HASH_MD5_FIELD)
    return mapped


def map_hr_employees_list(employees: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        map_hr_employee_to_app(employee)
        for employee in employees
        if isinstance(employee, dict)
    ]


def map_hr_employees_by_key(
    employees: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    mapped: dict[str, dict[str, Any]] = {}
    for key, employee in employees.items():
        if not isinstance(employee, dict):
            continue
        mapped_employee = map_hr_employee_to_app(employee)
        hsnils = mapped_employee.get("hsnils") or key
        mapped[hsnils] = mapped_employee
    return mapped
