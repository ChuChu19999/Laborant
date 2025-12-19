from typing import Optional
from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel
from core.security import IsAuthenticated
from services.employees import (
    get_employee_by_hash,
    get_employees_by_hashes,
    search_employees_by_fio,
)

router = APIRouter()


class EmployeesByHashesRequest(BaseModel):
    hashesMd5: list[str]
    includePhoto: Optional[bool] = False


@router.get(
    "/search/",
    summary="Поиск сотрудников по ФИО",
    description=(
        "Выполняет поиск сотрудников в HR системе по части ФИО. "
        "Минимальная длина поискового запроса - 3 символа. "
        "Возвращает список сотрудников с их данными, включая опционально фотографии."
    ),
    responses={
        200: {
            "description": "Список найденных сотрудников",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "hashMd5": "abc123...",
                            "fullName": "Иванов Иван Иванович",
                            "department": "Отдел IT",
                            "photo": "base64...",
                        }
                    ]
                }
            },
        },
        400: {"description": "Поисковый запрос слишком короткий (менее 3 символов)"},
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
        example="Иванов",
    ),
    include_photo: bool = Query(
        True,
        alias="includePhoto",
        description="Включать ли фотографии сотрудников в ответ",
    ),
):
    """Выполняет поиск сотрудников в HR системе по части ФИО."""
    try:
        employees = await search_employees_by_fio(
            search_fio, include_photo=include_photo
        )
        return employees
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=503, detail=f"Ошибка при обращении к HR API: {str(e)}"
        )


@router.get(
    "/{hash_md5}/",
    summary="Получение информации о сотруднике",
    description=(
        "Возвращает полную информацию о сотруднике по его hashMd5 (hsnils). "
        "Данные получаются из HR системы. Может включать фотографию сотрудника."
    ),
    responses={
        200: {
            "description": "Информация о сотруднике",
            "content": {
                "application/json": {
                    "example": {
                        "hashMd5": "abc123...",
                        "fullName": "Иванов Иван Иванович",
                        "department": "Отдел IT",
                        "division": "Разработка",
                        "login": "ivanov",
                        "photo": "base64...",
                    }
                }
            },
        },
        400: {"description": "Не указан hashMd5"},
        404: {"description": "Сотрудник не найден"},
        503: {"description": "Ошибка при обращении к HR API"},
    },
)
# @IsAuthenticated
async def get_employee(
    hash_md5: str,
    include_photo: bool = Query(
        True, alias="includePhoto", description="Включать ли фотографии в ответ"
    ),
):
    """Возвращает полную информацию о сотруднике по его hashMd5 (hsnils)."""
    if not hash_md5:
        raise HTTPException(status_code=400, detail="Необходимо указать hashMd5")

    try:
        employee = await get_employee_by_hash(hash_md5, include_photo=include_photo)
        if employee is None:
            raise HTTPException(status_code=404, detail="Сотрудник не найден")
        return employee
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=503, detail=f"Ошибка при обращении к HR API: {str(e)}"
        )


@router.post(
    "/by-hashes/",
    summary="Получение информации о сотрудниках (батч)",
    description=(
        "Возвращает информацию о нескольких сотрудниках по массиву hashMd5. "
        "Полезно для получения данных о множестве сотрудников одним запросом. "
        "Если массив пуст, возвращается пустой объект."
    ),
    responses={
        200: {
            "description": "Словарь с информацией о сотрудниках, где ключ - hashMd5",
            "content": {
                "application/json": {
                    "example": {
                        "abc123...": {
                            "hashMd5": "abc123...",
                            "fullName": "Иванов Иван Иванович",
                            "department": "Отдел IT",
                        },
                        "def456...": {
                            "hashMd5": "def456...",
                            "fullName": "Петров Петр Петрович",
                            "department": "Отдел продаж",
                        },
                    }
                }
            },
        },
        503: {"description": "Ошибка при обращении к HR API"},
    },
)
# @IsAuthenticated
async def get_employees_by_hashes_endpoint(
    request: EmployeesByHashesRequest = Body(...),
):
    """Возвращает информацию о нескольких сотрудниках по массиву hashMd5."""
    if not request.hashesMd5 or len(request.hashesMd5) == 0:
        return {}

    try:
        employees = await get_employees_by_hashes(
            request.hashesMd5, include_photo=request.includePhoto
        )
        return employees
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=503, detail=f"Ошибка при обращении к HR API: {str(e)}"
        )
