from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.exceptions import NotFoundError
from core.security import IsAuthenticated
from services.fixtures import (
    get_available_fixtures,
    get_fixture_data,
    list_fixture_files,
    list_fixture_subdirectories,
)
from services.saved_methods_tree import build_saved_methods_tree

router = APIRouter()


@router.get(
    "/fixtures/meta/directories/",
    summary="Дерево каталогов фикстур лаборатории",
    description=(
        "Все подкаталоги с JSON для выбранной лаборатории (например 26 съезд, нетипичные пробы). "
        "Используется для построения дерева без привязки только к текущему подразделению."
    ),
    responses={200: {"description": "Список каталогов"}},
)
# @IsAuthenticated
async def get_fixture_directories(
    laboratory_name: str = Query(..., description="Название лаборатории"),
):
    """Возвращает подкаталоги фикстур для лаборатории."""
    return {"directories": list_fixture_subdirectories(laboratory_name)}


@router.get(
    "/fixtures/meta/saved-methods-tree/",
    summary="Расчётные методы, применяемые в лабораториях (по подразделениям)",
    description=(
        "Методы исследования из базы (включая входящие в группы), по лаборатории "
        "и подразделению (если указано). Для дерева выбора шаблона на фронтенде."
    ),
    responses={200: {"description": "Дерево методов"}},
)
# @IsAuthenticated
async def get_saved_methods_tree(db: AsyncSession = Depends(get_db)):
    """Возвращает методы из базы, сгруппированные по лаборатории и подразделению."""
    return await build_saved_methods_tree(db)


@router.get(
    "/fixtures/",
    summary="Получение списка доступных фикстур",
    description=(
        "Возвращает список доступных фикстур методов исследования. "
        "Фикстуры используются для просмотра на фронтенде (как заполнять поля метода). "
        "Не создают методы автоматически, только для справки."
    ),
    responses={200: {"description": "Список фикстур успешно получен"}},
)
# @IsAuthenticated
async def get_fixtures(
    laboratory_name: Optional[str] = Query(
        None, description="Название лаборатории (например, ИЛНиНМ)"
    ),
    department_name: Optional[str] = Query(
        None, description="Название подразделения (например, 26 съезда КПСС)"
    ),
):
    """Возвращает список доступных фикстур методов исследования."""
    fixtures = get_available_fixtures(
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
):
    """Возвращает список файлов в указанной директории фикстуры."""
    files = list_fixture_files(fixture_path)
    return {"files": files}


@router.get(
    "/fixtures/{fixture_path:path}",
    summary="Получение данных конкретной фикстуры",
    description=(
        "Возвращает данные конкретной фикстуры по указанному пути. "
        "Путь к фикстуре указывается в формате, например: 'ilninm/26th/01.json'."
    ),
    responses={
        200: {"description": "Данные фикстуры успешно получены"},
        404: {"description": "Фикстура не найдена"},
    },
)
# @IsAuthenticated
async def get_fixture(
    fixture_path: str,
):
    """Возвращает данные конкретной фикстуры по указанному пути."""
    data = get_fixture_data(fixture_path)
    if data is None:
        raise NotFoundError("Фикстура не найдена")
    return data
