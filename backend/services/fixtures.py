from pathlib import Path
from typing import Any, Dict, List, Optional
import orjson
from core.logger import logger

FIXTURES_BASE_PATH = Path(__file__).parent.parent / "research_methods_fixtures"

FIXTURE_SUBDIR_LABELS = {
    "26th": "Типовые методы расчёта",
    "nspk": "Типовые методы расчёта",
    "non-typical": "Методы расчёта с особой логикой",
}


def get_available_fixtures(
    laboratory_name: Optional[str] = None,
    department_name: Optional[str] = None,
) -> List[str]:
    """
    Получить список доступных фикстур методов исследования.

    Фикстуры привязаны к названиям лабораторий/подразделений.
    Структура: research_methods_fixtures/{lab_name}/{fixture_type}/
    """
    if not FIXTURES_BASE_PATH.exists():
        logger.warning(f"Директория фикстур не найдена: {FIXTURES_BASE_PATH}")
        return []

    available_fixtures = []

    if laboratory_name and department_name:
        lab_name_normalized = _normalize_name(laboratory_name)
        dept_name_normalized = _normalize_name(department_name)

        lab_path = FIXTURES_BASE_PATH / lab_name_normalized
        if lab_path.exists() and lab_path.is_dir():
            for fixture_type_dir in lab_path.iterdir():
                if fixture_type_dir.is_dir():
                    fixture_type = fixture_type_dir.name
                    if _matches_department_name(fixture_type, department_name):
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


def get_fixture_data(fixture_path: str) -> Optional[Dict[str, Any]]:
    """
    Получить данные фикстуры по пути.
    """
    try:
        fixture_file = FIXTURES_BASE_PATH / fixture_path
        if not fixture_file.exists() or not fixture_file.is_file():
            logger.warning(f"Файл фикстуры не найден: {fixture_file}")
            return None

        with open(fixture_file, "rb") as f:
            return orjson.loads(f.read())
    except Exception as e:
        logger.error(f"Ошибка при чтении фикстуры {fixture_path}: {str(e)}")
        return None


def list_fixture_subdirectories(laboratory_name: str) -> List[Dict[str, Any]]:
    """
    Подкаталоги лаборатории с JSON-фикстурами для дерева выбора на фронтенде.

    Возвращает подкаталоги с JSON; отображаемое название берётся из FIXTURE_SUBDIR_LABELS (имя каталога на диске не меняется).
    Каталоги с одинаковой меткой объединяются в одну группу (paths).
    """
    lab_name_normalized = _normalize_name(laboratory_name)
    lab_path = FIXTURES_BASE_PATH / lab_name_normalized
    if not lab_path.exists() or not lab_path.is_dir():
        return []

    grouped_paths: Dict[str, List[str]] = {}
    label_order: List[str] = []

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

    entries: List[Dict[str, Any]] = []
    for label in label_order:
        paths = grouped_paths[label]
        entries.append({"path": paths[0], "paths": paths, "label": label})
    return entries


def list_fixture_files(fixture_path: str) -> List[str]:
    """
    Получить список файлов в директории фикстуры.
    """
    try:
        fixture_dir = FIXTURES_BASE_PATH / fixture_path
        if not fixture_dir.exists() or not fixture_dir.is_dir():
            return []

        json_files = [
            f.name for f in fixture_dir.iterdir() if f.is_file() and f.suffix == ".json"
        ]
        return sorted(json_files)
    except Exception as e:
        logger.error(
            f"Ошибка при получении списка файлов фикстуры {fixture_path}: {str(e)}"
        )
        return []


def _normalize_name(name: str) -> str:
    """Нормализация названия для поиска в файловой системе."""
    name_lower = name.lower().strip()
    name_mapping = {
        "илнинм": "ilninm",
        "умтсик": "umtsik",
        "26 съезда кпсс": "26th",
        "26th": "26th",
    }
    return name_mapping.get(name_lower, name_lower.replace(" ", "_"))


def _matches_department_name(fixture_type: str, department_name: str) -> bool:
    """Проверка соответствия типа фикстуры названию подразделения."""
    dept_name_normalized = _normalize_name(department_name)
    fixture_type_normalized = _normalize_name(fixture_type)
    return (
        dept_name_normalized == fixture_type_normalized
        or fixture_type_normalized in dept_name_normalized
    )


def _has_json_files(directory: Path) -> bool:
    """Проверка наличия JSON файлов в директории."""
    return any(f.is_file() and f.suffix == ".json" for f in directory.iterdir())
