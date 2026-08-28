from __future__ import annotations
from fastapi import APIRouter
from core.deps import CurrentUser
from schemas.user import UserResponse
from services.user import build_user_response_from_token

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
async def get_current_user_info(decoded_token: CurrentUser) -> UserResponse:
    return build_user_response_from_token(decoded_token)
