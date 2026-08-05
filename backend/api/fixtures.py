from __future__ import annotations
from fastapi import APIRouter, Query
from core.auth_decorators import IsAuthenticated
from core.deps import DbSession, UserPermissions
from services.access_control import enforce_lab_management_access
from services.fixtures import (
    get_fixture_data,
    list_available_fixtures,
    list_fixture_directories,
    list_fixture_files,
)
from services.saved_methods_tree import build_saved_methods_tree

router = APIRouter()


@router.get(
    "/fixtures/meta/directories/",
    summary="Получение дерева каталогов фикстур лаборатории",
    description=(
        "Возвращает подкаталоги с JSON для выбранной лаборатории "
        "(например, 26 съезда, нспк). "
        "Используется для построения дерева без привязки только к текущему подразделению."
    ),
    responses={200: {"description": "Список каталогов успешно получен"}},
)
# @IsAuthenticated
async def get_fixture_directories(
    effective: UserPermissions,
    laboratory_name: str = Query(..., description="Название лаборатории"),
):
    """Возвращает подкаталоги фикстур для указанной лаборатории."""
    enforce_lab_management_access(effective)
    return {"directories": list_fixture_directories(laboratory_name)}


@router.get(
    "/fixtures/meta/saved-methods-tree/",
    summary="Получение дерева расчетных методов по лабораториям",
    description=(
        "Возвращает методы исследования из базы (включая входящие в группы), "
        "сгруппированные по лаборатории и подразделению. "
        "Используется для дерева выбора шаблона на фронтенде."
    ),
    responses={200: {"description": "Дерево методов успешно получено"}},
)
# @IsAuthenticated
async def get_saved_methods_tree(
    db: DbSession,
    effective: UserPermissions,
):
    """Возвращает методы из базы, сгруппированные по лаборатории и подразделению."""
    enforce_lab_management_access(effective)
    return await build_saved_methods_tree(db)


@router.get(
    "/fixtures/",
    summary="Получение списка доступных фикстур",
    description=(
        "Возвращает список доступных фикстур методов исследования. "
        "Фикстуры используются для просмотра на фронтенде (как заполнять поля метода). "
        "Не создают методы автоматически, только для предзаполнения."
    ),
    responses={200: {"description": "Список фикстур успешно получен"}},
)
# @IsAuthenticated
async def get_fixtures(
    effective: UserPermissions,
    laboratory_name: str | None = Query(
        None, description="Название лаборатории (например, ИЛНиНМ)"
    ),
    department_name: str | None = Query(
        None, description="Название подразделения (например, 26 съезда КПСС)"
    ),
):
    """Возвращает список доступных фикстур методов исследования."""
    enforce_lab_management_access(effective)
    fixtures = list_available_fixtures(
        laboratory_name=laboratory_name, department_name=department_name
    )
    return {"fixtures": fixtures}


@router.get(
    "/fixtures/{fixture_path:path}/files/",
    summary="Получение списка файлов в директории фикстуры",
    description=(
        "Возвращает список файлов в указанной директории фикстуры. "
        "Путь к директории указывается в формате, например: 'ilninm/26th'."
    ),
    responses={200: {"description": "Список файлов успешно получен"}},
)
# @IsAuthenticated
async def list_fixture_files_endpoint(
    fixture_path: str,
    effective: UserPermissions,
):
    """Возвращает список файлов в указанной директории фикстуры."""
    enforce_lab_management_access(effective)
    files = list_fixture_files(fixture_path)
    return {"files": files}


@router.get(
    "/fixtures/{fixture_path:path}",
    summary="Получение данных фикстуры",
    description=(
        "Возвращает данные фикстуры по указанному пути. "
        "Путь указывается в формате, например: 'ilninm/26th/01.json'."
    ),
    responses={
        200: {"description": "Данные фикстуры успешно получены"},
        404: {"description": "Фикстура не найдена"},
    },
)
# @IsAuthenticated
async def get_fixture(
    fixture_path: str,
    effective: UserPermissions,
):
    """Возвращает данные фикстуры по указанному пути."""
    enforce_lab_management_access(effective)
    return get_fixture_data(fixture_path)
