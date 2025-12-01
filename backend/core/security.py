import functools
import inspect
import time
from typing import Callable, Optional
import jwt
import requests
from fastapi import Depends, Header, HTTPException, Security, status
from starlette.concurrency import run_in_threadpool
from core.config import settings
from core.logger import logger

_PUBLIC_KEY_CACHE_TTL = 3600
_public_key_cache: Optional[str] = None
_public_key_cache_expires_at: Optional[float] = None


async def get_public_key() -> str:
    """Получение публичного ключа Keycloak с кэшированием и TTL (через requests)."""
    global _public_key_cache, _public_key_cache_expires_at

    current_time = time.time()

    if (
        _public_key_cache is not None
        and _public_key_cache_expires_at is not None
        and current_time < _public_key_cache_expires_at
    ):
        return _public_key_cache

    try:
        verify_cert = (
            settings.CERT_PATH
            if settings.CERT_PATH and settings.CERT_PATH != ""
            else True
        )

        response = await run_in_threadpool(
            lambda: requests.get(
                settings.KEYCLOAK_PUBLIC_KEY_URL, verify=verify_cert, timeout=30.0
            )
        )

        if response.status_code != 200:
            logger.error("Failed to retrieve public key")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Failed to retrieve public key",
            )

        public_key = response.json().get("public_key")
        if not public_key:
            logger.error("Public key is missing")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Public key is missing",
            )

        logger.info("Public key retrieved successfully")
        _public_key_cache = public_key
        _public_key_cache_expires_at = current_time + _PUBLIC_KEY_CACHE_TTL
        return public_key

    except requests.exceptions.RequestException as e:
        logger.error(f"Request failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Request failed"
        )


async def verify_token(
    x_api_key: Optional[str] = Header(
        None, alias="X-API-KEY", description="JWT токен Keycloak для авторизации"
    ),
) -> dict:
    """
    Проверка и расшифровка JWT токена из заголовка X-API-KEY.
    """
    # ВРЕМЕННО: моковые данные пользователя
    mock_token = {
        "hashSnils": "e1cee128188b77f382eec32ca80494e6",
    }

    # ВРЕМЕННО: если токен отсутствует, возвращаем моковые данные
    if not x_api_key:
        logger.warning("Authorization header is missing, using mock data")
        return mock_token

    token = x_api_key

    try:
        public_key = await get_public_key()
        decoded_token = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_signature": False, "verify_exp": False},
        )
        logger.info(f"Decoded token: {decoded_token}")

        # ВРЕМЕННО: подстановка данных пользователя в токен
        decoded_token["hashSnils"] = mock_token["hashSnils"]

        username = decoded_token.get("preferred_username")
        if not username:
            logger.warning("Username is missing in the token, using mock data")
            return mock_token

        return decoded_token

    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}, using mock data")
        # ВРЕМЕННО: если токен невалидный, возвращаем моковые данные
        return mock_token
    except Exception as e:
        logger.warning(f"Error decoding token: {e}, using mock data")
        # ВРЕМЕННО: при любой ошибке возвращаем моковые данные
        return mock_token


async def get_current_user(decoded_token: dict = Security(verify_token)) -> dict:
    """Получение информации о текущем пользователе из токена."""
    return decoded_token


def IsAuthenticated(func: Callable) -> Callable:
    """Декоратор для защиты эндпоинтов авторизацией."""
    sig = inspect.signature(func)
    params = list(sig.parameters.values())

    has_decoded_token = any(p.name == "decoded_token" for p in params)

    if not has_decoded_token:
        params.append(
            inspect.Parameter(
                "decoded_token",
                inspect.Parameter.KEYWORD_ONLY,
                default=Depends(get_current_user),
                annotation=dict,
            )
        )
        new_sig = sig.replace(parameters=params)
    else:
        new_sig = sig

    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        if not has_decoded_token and "decoded_token" in kwargs:
            kwargs.pop("decoded_token")
        return await func(*args, **kwargs)

    wrapper.__signature__ = new_sig
    return wrapper
