from __future__ import annotations
from typing import Any, Literal, NoReturn
from urllib.parse import quote
import httpx
from core.config import settings
from core.exceptions import ServiceUnavailableError
from core.http_clients import get_hr_client
from core.logger import logger

_JSON_HEADERS = {"Content-Type": "application/json"}
_HR_UNAVAILABLE = "HR API недоступен"

HrMethod = Literal["GET", "POST"]


def _hr_url(path: str) -> str:
    """Собрать полный URL HR API из базового адреса и пути."""
    base = settings.HR_API_URL.rstrip("/")
    if not path.startswith("/"):
        path = f"/{path}"
    return f"{base}{path}"


def _raise_unavailable(
    exc: Exception,
    *,
    method: HrMethod | None = None,
    path: str | None = None,
) -> NoReturn:
    """Залогировать сбой HR API и выбросить ServiceUnavailableError."""
    if method is not None and path is not None:
        logger.error("{} {} {}: {}", _HR_UNAVAILABLE, method, _hr_url(path), exc)
    else:
        logger.error("{}: {}", _HR_UNAVAILABLE, exc)
    raise ServiceUnavailableError(f"{_HR_UNAVAILABLE}: {exc}") from exc


def _bool_param(value: bool) -> str:
    """Преобразовать bool в строку true/false для query-параметров HR API."""
    return "true" if value else "false"


def _fio_path(search_fio: str) -> str:
    """Сформировать путь поиска сотрудников по ФИО с экранированием."""
    return f"/api/v2/employee/by-fio/{quote(search_fio, safe='')}"


def _hash_path(hsnils: str) -> str:
    """Сформировать путь запроса сотрудника по hsnils с экранированием."""
    return f"/api/v2/employee/by-hash/{quote(hsnils, safe='')}"


def _search_params(
    *,
    include_dismissed: bool = True,
    include_photo: bool | None = None,
    records_number: int | None = None,
    include_appointments: bool | None = None,
) -> dict[str, str | int]:
    """Собрать query-параметры поиска сотрудников для HR API."""
    params: dict[str, str | int] = {
        "includeDismissed": _bool_param(include_dismissed),
    }
    if include_photo is not None:
        params["includePhoto"] = _bool_param(include_photo)
    if records_number is not None:
        params["recordsNumber"] = records_number
    if include_appointments is not None:
        params["includeAppointments"] = _bool_param(include_appointments)
    return params


async def hr_request_json(
    method: HrMethod,
    path: str,
    *,
    params: dict[str, str | int | bool] | None = None,
    json_body: dict[str, Any] | None = None,
) -> tuple[int, Any]:
    """Выполнить запрос к HR API и вернуть (status_code, json_body)."""
    client = get_hr_client()
    url = _hr_url(path)
    headers = _JSON_HEADERS if json_body is not None else None
    try:
        response = await client.request(
            method,
            url,
            headers=headers,
            params=params,
            json=json_body,
        )
    except httpx.RequestError as exc:
        _raise_unavailable(exc, method=method, path=path)

    try:
        if not response.content:
            return response.status_code, None
        return response.status_code, response.json()
    except ValueError as exc:
        _raise_unavailable(exc, method=method, path=path)


async def hr_get_employees_by_fio(
    search_fio: str,
    *,
    include_photo: bool = True,
    records_number: int = 10,
    include_dismissed: bool = True,
) -> tuple[int, Any]:
    """Запросить сотрудников по части ФИО."""
    return await hr_request_json(
        "GET",
        _fio_path(search_fio),
        params=_search_params(
            include_dismissed=include_dismissed,
            include_photo=include_photo,
            records_number=records_number,
        ),
    )


async def hr_get_employee_by_hsnils(
    hsnils: str,
    *,
    include_photo: bool | None = True,
    records_number: int | None = 1,
    include_dismissed: bool = True,
    include_appointments: bool | None = None,
) -> tuple[int, Any]:
    """Запросить сотрудника по hsnils."""
    return await hr_request_json(
        "GET",
        _hash_path(hsnils),
        params=_search_params(
            include_dismissed=include_dismissed,
            include_photo=include_photo,
            records_number=records_number,
            include_appointments=include_appointments,
        ),
    )


async def hr_post_employees_by_hsnils(
    hsnils_list: list[str],
    *,
    include_photo: bool = False,
    include_extended: bool = False,
    include_exp: bool = False,
    include_dismissed: bool = True,
    include_appointments: bool = False,
) -> tuple[int, Any]:
    """Запросить сотрудников пакетом по списку hsnils."""
    return await hr_request_json(
        "POST",
        "/api/v2/employee/by-hashes/",
        json_body={
            "hashesMd5": hsnils_list,
            "includeExtended": include_extended,
            "includePhoto": include_photo,
            "includeExp": include_exp,
            "includeDismissed": include_dismissed,
            "includeAppointments": include_appointments,
        },
    )
