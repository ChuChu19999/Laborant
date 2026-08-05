from __future__ import annotations
from typing import Any
from core.exceptions import NotFoundError
from utils import fixtures as fixtures_utils


def list_fixture_directories(laboratory_name: str) -> list[dict[str, Any]]:
    """Подкаталоги фикстур для указанной лаборатории."""
    return fixtures_utils.list_fixture_subdirectories(laboratory_name)


def list_available_fixtures(
    laboratory_name: str | None = None,
    department_name: str | None = None,
) -> list[str]:
    """Список доступных фикстур методов исследования."""
    return fixtures_utils.get_available_fixtures(
        laboratory_name=laboratory_name,
        department_name=department_name,
    )


def list_fixture_files(fixture_path: str) -> list[str]:
    """Список файлов в директории фикстуры."""
    return fixtures_utils.list_fixture_files(fixture_path)


def get_fixture_data(fixture_path: str) -> dict[str, Any]:
    """Данные фикстуры по пути. Поднимает NotFoundError, если файл не найден."""
    data = fixtures_utils.get_fixture_data(fixture_path)
    if data is None:
        raise NotFoundError("Фикстура не найдена")
    return data
