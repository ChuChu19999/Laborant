from pathlib import Path
from typing import Annotated, Any
from pydantic import BeforeValidator, PostgresDsn
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

env_path = Path(__file__).parent.parent / ".env"


def _split_cors_values(value: Any) -> Any:
    """Разбирает CORS-строку из env: '*' или список по пробелам."""
    if isinstance(value, str):
        if value == "*":
            return ["*"]
        if not value.strip():
            return []
        return [item.strip() for item in value.split(" ") if item.strip()]
    return value


CorsSpaceSeparated = Annotated[list[str], NoDecode, BeforeValidator(_split_cors_values)]


class Settings(BaseSettings):
    """Настройки приложения из переменных окружения."""

    model_config = SettingsConfigDict(env_file=str(env_path), case_sensitive=True)

    DEBUG: bool

    DATABASE_URL: PostgresDsn
    POSTGRES_DB_SCHEMA: str

    CORS_ALLOWED_ORIGINS: CorsSpaceSeparated
    CORS_ALLOW_METHODS: CorsSpaceSeparated
    CORS_ALLOW_HEADERS: CorsSpaceSeparated
    CORS_ALLOW_CREDENTIALS: bool

    KEYCLOAK_PUBLIC_KEY_URL: str

    CERT_PATH: str

    HR_API_URL: str

    LOG_HEADERS: bool


settings = Settings()  # type: ignore[call-arg]


def get_database_schema() -> str:
    """Вернуть имя схемы базы данных."""
    return settings.POSTGRES_DB_SCHEMA
