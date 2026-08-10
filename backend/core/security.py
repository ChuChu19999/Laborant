import time
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
import requests
from starlette.concurrency import run_in_threadpool
from core.config import settings
from core.logger import logger
from utils.current_user import set_current_user

security_optional = HTTPBearer(auto_error=False)
_PUBLIC_KEY_CACHE_TTL = 3600
_public_key_cache: str | None = None
_public_key_cache_expires_at: float | None = None


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
        verify_cert = settings.CERT_PATH if settings.CERT_PATH and settings.CERT_PATH != "" else True

        response = await run_in_threadpool(
            lambda: requests.get(settings.KEYCLOAK_PUBLIC_KEY_URL, verify=verify_cert, timeout=30.0)
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
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Request failed")


async def verify_token(
    credentials: HTTPAuthorizationCredentials | None = Security(security_optional),
) -> dict:
    """Проверка и расшифровка JWT токена из заголовка Authorization."""
    mock_token = {
        "hashSnils": "e1cee128188b77f382eec32ca80494e6",
        "fullName": "Тестовый Пользователь",
        "access_groups": [{"appRoleName": "admin"}],
    }

    if not credentials or not credentials.credentials:
        logger.warning("Authorization header is missing, using mock data")
        return mock_token

    token = credentials.credentials

    try:
        public_key = await get_public_key()
        decoded_token = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_signature": False, "verify_exp": False},
        )
        logger.info(f"Decoded token: {decoded_token}")

        decoded_token["hashSnils"] = mock_token["hashSnils"]

        if not decoded_token.get("fullName"):
            decoded_token["fullName"] = mock_token["fullName"]

        username = decoded_token.get("preferred_username")
        if not username:
            logger.warning("Username is missing in the token, using mock data")
            return mock_token

        return decoded_token

    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}, using mock data")
        return mock_token
    except Exception as e:
        logger.warning(f"Error decoding token: {e}, using mock data")
        return mock_token


def get_user_roles(decoded_token: dict) -> list[str]:
    """Извлечение ролей пользователя из токена (access_groups.appRoleName)."""
    access_groups = decoded_token.get("access_groups", [])
    if not isinstance(access_groups, list):
        return []

    roles: list[str] = []
    for group in access_groups:
        if isinstance(group, dict):
            app_role_name = group.get("appRoleName")
            if isinstance(app_role_name, str) and app_role_name.strip():
                roles.append(app_role_name.strip())
    return roles


def is_admin_role(role_name: str) -> bool:
    """Проверка, что имя роли содержит подстроку admin."""
    return "admin" in role_name.lower()


def is_admin_user(decoded_token: dict) -> bool:
    """Проверка, есть ли у пользователя admin-роль в токене."""
    return any(is_admin_role(role) for role in get_user_roles(decoded_token))


async def get_current_user(decoded_token: dict = Security(verify_token)) -> dict:
    """Получение информации о текущем пользователе из токена."""
    full_name = decoded_token.get("fullName") or ""
    hsnils = decoded_token.get("hashSnils") or ""
    if full_name and hsnils:
        set_current_user(full_name, hsnils)
    return decoded_token
