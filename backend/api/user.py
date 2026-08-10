from __future__ import annotations
from fastapi import APIRouter, Depends
from core.security import get_current_user
from schemas.user import UserResponse

router = APIRouter()


@router.get(
    "/me/",
    response_model=UserResponse,
    summary="Получение информации о текущем пользователе",
    description=(
        "Возвращает информацию о текущем авторизованном пользователе на основе JWT токена. "
        "Извлекает данные пользователя из токена и возвращает hsnils."
    ),
    responses={
        200: {
            "description": "Информация о пользователе успешно получена",
            "content": {
                "application/json": {
                    "example": {
                        "hsnils": "e1cee128188b77f382eec32ca80494e6",
                        "full_name": "Иванов Иван Иванович",
                        "email": "i.i.ivanov@gd-urengoy.gazprom.ru",
                    }
                }
            },
        },
        401: {"description": "Токен отсутствует или невалидный"},
    },
)
# @IsAuthenticated
async def get_current_user_info(decoded_token: dict = Depends(get_current_user)):
    """Возвращает информацию о текущем авторизованном пользователе на основе JWT токена."""
    return UserResponse(
        personnel_number=decoded_token.get("personnelNumber"),
        department_number=decoded_token.get("departmentNumber"),
        full_name=decoded_token.get("fullName"),
        ad_login=decoded_token.get("preferred_username"),
        email=decoded_token.get("email"),
        hsnils=decoded_token.get("hashSnils"),
        is_staff=False,
    )
