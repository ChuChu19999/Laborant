from __future__ import annotations
from pathlib import Path
from typing import Any
import orjson
from core.logger import logger

FIXTURES_BASE_PATH = Path(__file__).parent.parent / "research_methods_fixtures"

FIXTURE_SUBDIR_LABELS = {
    "26th": "Типовые методы расчёта",
    "nspk": "Типовые методы расчёта",
    "non-typical": "Методы расчёта с особой логикой",
}


def resolve_fixture_path(relative_path: str) -> Path | None:
    """
    Разрешить относительный путь внутри каталога фикстур.

    Пустой, абсолютный или выходящий за базу путь даёт None.
    """
    if not relative_path or not str(relative_path).strip():
        return None

    cleaned = str(relative_path).strip().replace("\\", "/")
    path = Path(cleaned)
    if path.is_absolute() or any(part == ".." for part in path.parts):
        return None

    base = FIXTURES_BASE_PATH.resolve()
    candidate = (base / path).resolve()
    try:
        candidate.relative_to(base)
    except ValueError:
        return None
    return candidate


def get_available_fixtures(
    laboratory_name: str | None = None,
    department_name: str | None = None,
) -> list[str]:
    """
    Список относительных путей каталогов фикстур по лаборатории и подразделению.

    Структура в проекте: research_methods_fixtures/{lab_name}/{fixture_type}/.
    """
    if not FIXTURES_BASE_PATH.exists():
        logger.warning(f"Директория фикстур не найдена: {FIXTURES_BASE_PATH}")
        return []

    available_fixtures: list[str] = []

    if laboratory_name and department_name:
        lab_name_normalized = _normalize_name(laboratory_name)
        dept_name_normalized = _normalize_name(department_name)

        lab_path = FIXTURES_BASE_PATH / lab_name_normalized
        if lab_path.exists() and lab_path.is_dir():
            for fixture_type_dir in lab_path.iterdir():
                if fixture_type_dir.is_dir():
                    fixture_type = fixture_type_dir.name
                    if _matches_department_name(fixture_type, dept_name_normalized):
                        fixture_path = f"{lab_name_normalized}/{fixture_type}"
                        if _has_json_files(fixture_type_dir):
                            available_fixtures.append(fixture_path)

    elif laboratory_name:
        lab_name_normalized = _normalize_name(laboratory_name)
        lab_path = FIXTURES_BASE_PATH / lab_name_normalized
        if lab_path.exists() and lab_path.is_dir():
            for fixture_type_dir in lab_path.iterdir():
                if fixture_type_dir.is_dir():
                    fixture_path = f"{lab_name_normalized}/{fixture_type_dir.name}"
                    if _has_json_files(fixture_type_dir):
                        available_fixtures.append(fixture_path)

    else:
        for lab_dir in FIXTURES_BASE_PATH.iterdir():
            if lab_dir.is_dir():
                lab_name = lab_dir.name
                for fixture_type_dir in lab_dir.iterdir():
                    if fixture_type_dir.is_dir():
                        fixture_path = f"{lab_name}/{fixture_type_dir.name}"
                        if _has_json_files(fixture_type_dir):
                            available_fixtures.append(fixture_path)

    return sorted(available_fixtures)


def read_fixture_json(fixture_file: Path) -> dict[str, Any] | None:
    """Прочитать JSON-файл фикстуры; при ошибке чтения или разбора — None."""
    try:
        with open(fixture_file, "rb") as f:
            payload = orjson.loads(f.read())
        if not isinstance(payload, dict):
            logger.error(f"Корень фикстуры должен быть объектом: {fixture_file}")
            return None
        return payload
    except (OSError, orjson.JSONDecodeError, ValueError) as e:
        logger.error(f"Ошибка при чтении фикстуры {fixture_file}: {e!s}")
        return None


def get_fixture_data(fixture_path: str) -> dict[str, Any] | None:
    """Прочитать данные фикстуры по относительному пути; вне базы или нет файла — None."""
    fixture_file = resolve_fixture_path(fixture_path)
    if fixture_file is None or not fixture_file.is_file():
        return None
    return read_fixture_json(fixture_file)


def list_fixture_subdirectories(laboratory_name: str) -> list[dict[str, Any]]:
    """
    Подкаталоги лаборатории с JSON-фикстурами для дерева выбора.

    Метки берутся из FIXTURE_SUBDIR_LABELS; каталоги с одной меткой объединяются в paths.
    """
    lab_name_normalized = _normalize_name(laboratory_name)
    lab_path = FIXTURES_BASE_PATH / lab_name_normalized
    if not lab_path.exists() or not lab_path.is_dir():
        return []

    grouped_paths: dict[str, list[str]] = {}
    label_order: list[str] = []

    for fixture_type_dir in sorted(lab_path.iterdir(), key=lambda p: p.name):
        if fixture_type_dir.is_dir() and _has_json_files(fixture_type_dir):
            rel = f"{lab_name_normalized}/{fixture_type_dir.name}"
            label = FIXTURE_SUBDIR_LABELS.get(
                fixture_type_dir.name,
                fixture_type_dir.name.replace("-", " ").replace("_", " "),
            )
            if label not in grouped_paths:
                grouped_paths[label] = []
                label_order.append(label)
            grouped_paths[label].append(rel)

    entries: list[dict[str, Any]] = []
    for label in label_order:
        paths = grouped_paths[label]
        entries.append({"path": paths[0], "paths": paths, "label": label})
    return entries


def list_json_filenames(directory: Path) -> list[str]:
    """Имена JSON-файлов в каталоге по алфавиту."""
    try:
        return sorted(f.name for f in directory.iterdir() if f.is_file() and f.suffix == ".json")
    except OSError as e:
        logger.error(f"Ошибка при чтении каталога фикстур {directory}: {e!s}")
        return []


def list_fixture_files(fixture_path: str) -> list[str] | None:
    """
    Список JSON в каталоге фикстуры.

    None — путь вне базы или каталога нет; пустой список — каталог есть, JSON нет.
    """
    fixture_dir = resolve_fixture_path(fixture_path)
    if fixture_dir is None or not fixture_dir.is_dir():
        return None
    return list_json_filenames(fixture_dir)


def _normalize_name(name: str) -> str:
    """Нормализует название лаборатории/подразделения для поиска на диске."""
    name_lower = name.lower().strip()
    name_mapping = {
        "илнинм": "ilninm",
        "умтсик": "umtsik",
        "26 съезда кпсс": "26th",
        "26th": "26th",
    }
    return name_mapping.get(name_lower, name_lower.replace(" ", "_"))


def _matches_department_name(fixture_type: str, department_name_normalized: str) -> bool:
    """Проверяет, соответствует ли тип каталога фикстур подразделению."""
    fixture_type_normalized = _normalize_name(fixture_type)
    return (
        department_name_normalized == fixture_type_normalized or fixture_type_normalized in department_name_normalized
    )


def _has_json_files(directory: Path) -> bool:
    """Проверяет, есть ли в каталоге хотя бы один JSON-файл."""
    return any(f.is_file() and f.suffix == ".json" for f in directory.iterdir())
