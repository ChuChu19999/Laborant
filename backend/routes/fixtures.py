from typing import Optional
from fastapi import APIRouter, Query
from core.exceptions import NotFoundError
from core.security import IsAuthenticated
from services.fixtures import (
    get_available_fixtures,
    get_fixture_data,
    list_fixture_files,
)

router = APIRouter()


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
    """
    Получить список доступных фикстур методов исследования.

    Фикстуры используются для просмотра на фронтенде (как заполнять поля метода).
    Не создают методы автоматически, только для справки.
    """
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
    """
    Получить список файлов в директории фикстуры.
    """
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
    """
    Получить данные конкретной фикстуры.
    """
    data = get_fixture_data(fixture_path)
    if data is None:
        raise NotFoundError("Фикстура не найдена")
    return data
