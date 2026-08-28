from __future__ import annotations
from pathlib import Path
from core.exceptions import DomainValidationError, NotFoundError
from schemas.fixtures import (
    FixtureDataResponse,
    FixtureDirectoriesResponse,
    FixtureDirectoryEntry,
    FixtureFilesResponse,
    FixturesListResponse,
)
from utils import fixtures as fixtures_utils


def _require_resolved_fixture_path(fixture_path: str) -> Path:
    """Проверить, что путь относительный и лежит внутри каталога фикстур."""
    resolved = fixtures_utils.resolve_fixture_path(fixture_path)
    if resolved is None:
        raise DomainValidationError("Некорректный путь фикстуры")
    return resolved


def get_fixture_directories(laboratory_name: str) -> FixtureDirectoriesResponse:
    """Вернуть группы каталогов фикстур лаборатории; если каталога нет — пустой список."""
    entries = [
        FixtureDirectoryEntry.model_validate(item)
        for item in fixtures_utils.list_fixture_subdirectories(laboratory_name)
    ]
    return FixtureDirectoriesResponse(directories=entries)


def list_fixtures(
    laboratory_name: str | None = None,
    department_name: str | None = None,
) -> FixturesListResponse:
    """Вернуть доступные пути каталогов фикстур; при отсутствии совпадений — пустой список."""
    return FixturesListResponse(
        fixtures=fixtures_utils.get_available_fixtures(
            laboratory_name=laboratory_name,
            department_name=department_name,
        )
    )


def list_fixture_files(fixture_path: str) -> FixtureFilesResponse:
    """
    Вернуть JSON-файлы в каталоге фикстуры.

    Некорректный путь — DomainValidationError; каталога нет — NotFoundError;
    каталог есть без JSON — пустой список.
    """
    _require_resolved_fixture_path(fixture_path)
    files = fixtures_utils.list_fixture_files(fixture_path)
    if files is None:
        raise NotFoundError("Каталог фикстуры не найден")
    return FixtureFilesResponse(files=files)


def get_fixture_data(fixture_path: str) -> FixtureDataResponse:
    """
    Вернуть JSON фикстуры по относительному пути.

    Некорректный путь — DomainValidationError; файла нет — NotFoundError;
    битый JSON — DomainValidationError.
    """
    resolved = _require_resolved_fixture_path(fixture_path)
    if not resolved.is_file():
        raise NotFoundError("Фикстура не найдена")

    data = fixtures_utils.read_fixture_json(resolved)
    if data is None:
        raise DomainValidationError("Некорректный JSON фикстуры")
    return FixtureDataResponse.model_validate(data)
