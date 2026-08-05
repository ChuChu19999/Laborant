from __future__ import annotations
from typing import Any
import httpx
from core.config import settings
from core.exceptions import ServiceUnavailableError
from core.http_clients import get_hr_client
from core.logger import logger

_JSON_HEADERS = {"Content-Type": "application/json"}
_HR_UNAVAILABLE = "HR API недоступен"


def _hr_url(path: str) -> str:
    base = settings.HR_API_URL.rstrip("/")
    if not path.startswith("/"):
        path = f"/{path}"
    return f"{base}{path}"


def _raise_unavailable(exc: Exception) -> None:
    logger.error(f"{_HR_UNAVAILABLE}: {exc}")
    raise ServiceUnavailableError(f"{_HR_UNAVAILABLE}: {exc}") from exc


async def hr_request_json(
    method: str,
    path: str,
    *,
    params: dict[str, str | int | bool] | None = None,
    json_body: dict[str, Any] | None = None,
) -> tuple[int, Any]:
    """
    Запрос к HR API.

    Возвращает (status_code, json_body). Сеть и битый JSON → ServiceUnavailableError.
    """
    client = await get_hr_client()
    url = _hr_url(path)
    try:
        response = await client.request(
            method,
            url,
            headers=_JSON_HEADERS,
            params=params,
            json=json_body,
        )
    except httpx.RequestError as exc:
        _raise_unavailable(exc)
        raise

    try:
        if not response.content:
            return response.status_code, None
        return response.status_code, response.json()
    except ValueError as exc:
        _raise_unavailable(exc)
        raise
