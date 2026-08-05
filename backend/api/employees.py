from __future__ import annotations
from fastapi import APIRouter, Body, Query
from core.auth_decorators import IsAuthenticated
from core.exceptions import ValidationError
from schemas.employees import EmployeesByHsnilsRequest
from services.employees import (
    get_employee_by_hsnils,
    get_employees_by_hsnils,
    search_employees_by_fio,
    search_employees_by_fio_and_laboratory,
)

router = APIRouter()


@router.get(
    "/search/",
    summary="Поиск сотрудников по ФИО",
    description=(
        "Возвращает список сотрудников, найденных в HR API по части ФИО. "
        "Минимальная длина поискового запроса - 3 символа. "
        "Может включать фотографии сотрудников."
    ),
    responses={
        200: {
            "description": "Список найденных сотрудников",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "hsnils": "abc123...",
                            "fullName": "Иванов Иван Иванович",
                            "photo": "base64...",
                        }
                    ]
                }
            },
        },
        400: {"description": "Поисковый запрос короче 3 символов"},
        503: {"description": "Ошибка при обращении к HR API"},
    },
)
# @IsAuthenticated
async def search_employees(
    search_fio: str = Query(
        ...,
        min_length=3,
        alias="searchFio",
        description="Часть ФИО для поиска (минимум 3 символа)",
        examples=["Иванов"],
    ),
    include_photo: bool = Query(
        True,
        alias="includePhoto",
        description="Включать ли фотографии сотрудников в ответ",
    ),
):
    """Возвращает список сотрудников, найденных в HR API по части ФИО."""
    return await search_employees_by_fio(search_fio, include_photo=include_photo)


@router.get(
    "/search-by-laboratory/",
    summary="Поиск сотрудников по ФИО с фильтрацией по лаборатории",
    description=(
        "Возвращает список сотрудников, найденных в HR API по части ФИО "
        "с фильтрацией по наименованию лаборатории. "
        "Минимальная длина поискового запроса - 3 символа. "
        "Может включать фотографии сотрудников."
    ),
    responses={
        200: {
            "description": "Список найденных сотрудников",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "hsnils": "abc123...",
                            "fullName": "Иванов Иван Иванович",
                            "photo": "base64...",
                        }
                    ]
                }
            },
        },
        400: {
            "description": (
                "Поисковый запрос короче 3 символов или не указано наименование лаборатории"
            )
        },
        503: {"description": "Ошибка при обращении к HR API"},
    },
)
# @IsAuthenticated
async def search_employees_by_laboratory(
    search_fio: str = Query(
        ...,
        min_length=3,
        alias="searchFio",
        description="Часть ФИО для поиска (минимум 3 символа)",
        examples=["Иванов"],
    ),
    laboratory_name: str = Query(
        ...,
        alias="laboratoryName",
        description="Наименование лаборатории для фильтрации",
        examples=["Испытательная лаборатория нефти и нефтяных масел"],
    ),
    include_photo: bool = Query(
        True,
        alias="includePhoto",
        description="Включать ли фотографии сотрудников в ответ",
    ),
):
    """Возвращает список сотрудников, найденных в HR API по части ФИО с фильтрацией по лаборатории."""
    if not laboratory_name:
        raise ValidationError("Не указано наименование лаборатории")

    return await search_employees_by_fio_and_laboratory(
        search_fio, laboratory_name, include_photo=include_photo
    )


@router.get(
    "/{hsnils}/",
    summary="Получение информации о сотруднике",
    description=(
        "Возвращает полную информацию о сотруднике по hsnils из HR API. "
        "Может включать фотографию сотрудника."
    ),
    responses={
        200: {
            "description": "Информация о сотруднике",
            "content": {
                "application/json": {
                    "example": {
                        "hsnils": "abc123...",
                        "fullName": "Иванов Иван Иванович",
                        "login": "i.i.ivanov",
                        "photo": "base64...",
                    }
                }
            },
        },
        400: {"description": "Не указан hsnils"},
        404: {"description": "Сотрудник не найден"},
        503: {"description": "Ошибка при обращении к HR API"},
    },
)
# @IsAuthenticated
async def get_employee(
    hsnils: str,
    include_photo: bool = Query(
        True,
        alias="includePhoto",
        description="Включать ли фотографии сотрудников в ответ",
    ),
):
    """Возвращает полную информацию о сотруднике по hsnils из HR API."""
    if not hsnils:
        raise ValidationError("Не указан hsnils")

    return await get_employee_by_hsnils(hsnils, include_photo=include_photo)


@router.post(
    "/by-hsnils/",
    summary="Получение информации о сотрудниках (батч)",
    description=(
        "Возвращает информацию о сотрудниках по массиву hsnils. "
        "Подходит для получения данных о нескольких сотрудниках одним запросом. "
        "При пустом массиве возвращает пустой объект."
    ),
    responses={
        200: {
            "description": "Словарь с информацией о сотрудниках, где ключ - hsnils",
            "content": {
                "application/json": {
                    "example": {
                        "abc123...": {
                            "hsnils": "abc123...",
                            "fullName": "Иванов Иван Иванович",
                        },
                        "def456...": {
                            "hsnils": "def456...",
                            "fullName": "Петров Петр Петрович",
                        },
                    }
                }
            },
        },
        503: {"description": "Ошибка при обращении к HR API"},
    },
)
# @IsAuthenticated
async def get_employees_by_hsnils_endpoint(
    request: EmployeesByHsnilsRequest = Body(...),
):
    """Возвращает информацию о сотрудниках по массиву hsnils."""
    if not request.hsnils:
        return {}

    return await get_employees_by_hsnils(
        request.hsnils, include_photo=request.includePhoto
    )
