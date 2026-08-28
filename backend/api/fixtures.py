from __future__ import annotations
from fastapi import APIRouter, Query
from core.deps import DbSession, UserPermissions
from schemas.fixtures import (
    FixtureDataResponse,
    FixtureDirectoriesResponse,
    FixtureFilesResponse,
    FixturesListResponse,
    SavedMethodsTreeResponse,
)
from services.access_control import enforce_lab_management_access
from services.fixtures import (
    get_fixture_data,
    get_fixture_directories,
    list_fixture_files,
    list_fixtures,
)
from services.research_methods_tree import build_research_methods_tree

router = APIRouter()


@router.get(
    "/fixtures/meta/directories/",
    response_model=FixtureDirectoriesResponse,
    summary="Получение дерева каталогов фикстур лаборатории",
    description=(
        "Возвращает подкаталоги с JSON для выбранной лаборатории "
        "(например, 26 съезда, нспк). "
        "Используется для построения дерева без привязки только к текущему подразделению."
    ),
    responses={
        200: {"description": "Список каталогов успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def get_fixture_directories_endpoint(
    effective: UserPermissions,
    laboratory_name: str = Query(..., description="Название лаборатории"),
) -> FixtureDirectoriesResponse:
    enforce_lab_management_access(effective)
    return get_fixture_directories(laboratory_name)


@router.get(
    "/fixtures/meta/saved-methods-tree/",
    response_model=SavedMethodsTreeResponse,
    summary="Получение дерева расчётных методов по лабораториям",
    description=(
        "Возвращает методы исследования из базы (включая входящие в группы), "
        "сгруппированные по лаборатории и подразделению. "
        "Используется для дерева выбора шаблона на фронтенде."
    ),
    responses={
        200: {"description": "Дерево методов успешно получено"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def get_research_methods_tree(
    db: DbSession,
    effective: UserPermissions,
) -> SavedMethodsTreeResponse:
    enforce_lab_management_access(effective)
    return await build_research_methods_tree(db)


@router.get(
    "/fixtures/",
    response_model=FixturesListResponse,
    summary="Получение списка доступных фикстур",
    description=(
        "Возвращает список доступных фикстур методов исследования. "
        "Фикстуры используются для просмотра на фронтенде (как заполнять поля метода). "
        "Не создают методы автоматически, только для предзаполнения."
    ),
    responses={
        200: {"description": "Список фикстур успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def get_fixtures(
    effective: UserPermissions,
    laboratory_name: str | None = Query(None, description="Название лаборатории (например, ИЛНиНМ)"),
    department_name: str | None = Query(None, description="Название подразделения (например, 26 съезда КПСС)"),
) -> FixturesListResponse:
    enforce_lab_management_access(effective)
    return list_fixtures(laboratory_name=laboratory_name, department_name=department_name)


@router.get(
    "/fixtures/{fixture_path:path}/files/",
    response_model=FixtureFilesResponse,
    summary="Получение списка файлов в директории фикстуры",
    description=(
        "Возвращает список файлов в указанной директории фикстуры. "
        "Путь к директории указывается в формате, например: 'ilninm/26th'."
    ),
    responses={
        200: {"description": "Список файлов успешно получен"},
        400: {"description": "Некорректный путь фикстуры"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Каталог фикстуры не найден"},
    },
)
# @IsAuthenticated
async def list_fixture_files_endpoint(
    fixture_path: str,
    effective: UserPermissions,
) -> FixtureFilesResponse:
    enforce_lab_management_access(effective)
    return list_fixture_files(fixture_path)


@router.get(
    "/fixtures/{fixture_path:path}",
    response_model=FixtureDataResponse,
    summary="Получение данных фикстуры",
    description=(
        "Возвращает данные фикстуры по указанному пути. Путь указывается в формате, например: 'ilninm/26th/01.json'."
    ),
    responses={
        200: {"description": "Данные фикстуры успешно получены"},
        400: {"description": "Некорректный путь или JSON фикстуры"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Фикстура не найдена"},
    },
)
# @IsAuthenticated
async def get_fixture(
    fixture_path: str,
    effective: UserPermissions,
) -> FixtureDataResponse:
    enforce_lab_management_access(effective)
    return get_fixture_data(fixture_path)
