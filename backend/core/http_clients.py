from typing import Optional
import httpx
from core.logger import logger

_hr_client: Optional[httpx.AsyncClient] = None


async def get_hr_client() -> httpx.AsyncClient:
    """
    Получение переиспользуемого HTTP клиента для HR API.
    Клиент создается один раз и переиспользуется для всех запросов.
    """
    global _hr_client
    if _hr_client is None:
        _hr_client = httpx.AsyncClient(
            verify=False,
            timeout=10.0,
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
        )
    return _hr_client


async def close_all_clients():
    """
    Закрытие всех HTTP клиентов (вызывается при завершении приложения).
    """
    global _hr_client

    if _hr_client is not None:
        await _hr_client.aclose()
        _hr_client = None
        logger.info("HR клиент закрыт")
