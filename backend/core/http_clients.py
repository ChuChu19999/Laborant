import httpx
from core.logger import logger

_hr_client: httpx.AsyncClient | None = None


def init_hr_client() -> None:
    """Создать переиспользуемый HTTP-клиент для HR API."""
    global _hr_client
    if _hr_client is not None:
        return
    # verify=False: внутренний HR API без доверенного CA; осознанное отключение проверки TLS.
    _hr_client = httpx.AsyncClient(
        verify=False,
        timeout=10.0,
        limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
    )


def get_hr_client() -> httpx.AsyncClient:
    """Вернуть уже созданный HR-клиент."""
    if _hr_client is None:
        raise RuntimeError("HR HTTP-клиент не инициализирован. Вызовите init_hr_client() при старте.")
    return _hr_client


async def close_all_clients() -> None:
    """Закрыть все HTTP-клиенты (при завершении приложения)."""
    global _hr_client

    if _hr_client is not None:
        await _hr_client.aclose()
        _hr_client = None
        logger.info("HR клиент закрыт")
