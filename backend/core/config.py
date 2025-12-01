from pathlib import Path
from pydantic_settings import BaseSettings

env_path = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    """Настройки приложения из переменных окружения."""

    SECRET_KEY: str
    DEBUG: bool = False

    DATABASE_URL: str
    POSTGRES_DB_SCHEMA: str = ""

    CORS_ALLOWED_ORIGINS: str = ""
    CORS_ALLOW_METHODS: str = ""
    CORS_ALLOW_HEADERS: str = ""
    CORS_ALLOW_CREDENTIALS: bool

    KEYCLOAK_PUBLIC_KEY_URL: str = ""

    CERT_PATH: str = "/usr/local/share/ca-certificates/root.crt"

    HR_API_URL: str = ""

    LOG_HEADERS: bool = False

    @property
    def DATABASE_SCHEMA(self) -> str:
        """Название схемы PostgreSQL."""
        return self.POSTGRES_DB_SCHEMA

    @property
    def cors_allowed_origins_list(self) -> list[str]:
        """Список разрешенных origins для CORS."""
        if not self.CORS_ALLOWED_ORIGINS or self.CORS_ALLOWED_ORIGINS.strip() == "":
            return []
        return [
            origin.strip()
            for origin in self.CORS_ALLOWED_ORIGINS.split(" ")
            if origin.strip()
        ]

    @property
    def cors_allow_methods_list(self) -> list[str]:
        """Список разрешенных методов для CORS."""
        if self.CORS_ALLOW_METHODS == "*":
            return ["*"]
        if not self.CORS_ALLOW_METHODS or self.CORS_ALLOW_METHODS.strip() == "":
            return []
        return [
            method.strip()
            for method in self.CORS_ALLOW_METHODS.split(" ")
            if method.strip()
        ]

    @property
    def cors_allow_headers_list(self) -> list[str]:
        """Список разрешенных заголовков для CORS."""
        if self.CORS_ALLOW_HEADERS == "*":
            return ["*"]
        if not self.CORS_ALLOW_HEADERS or self.CORS_ALLOW_HEADERS.strip() == "":
            return []
        return [
            header.strip()
            for header in self.CORS_ALLOW_HEADERS.split(" ")
            if header.strip()
        ]

    class Config:
        env_file = str(env_path)
        case_sensitive = True


settings = Settings()


def get_database_schema() -> str:
    """Возвращает имя схемы базы данных."""
    return settings.DATABASE_SCHEMA
