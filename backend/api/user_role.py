from __future__ import annotations
from fastapi import APIRouter
from core.deps import CurrentUser, DbSession
from schemas.role import UserPermissionsResponse
from services.user_permissions import get_user_permissions_or_raise

router = APIRouter()


@router.get(
    "/user-roles/me/",
    response_model=UserPermissionsResponse,
    summary="Права текущего пользователя",
    description=(
        "Возвращает права доступа по ролям из токена "
        "и справочника ролей. Несколько ролей объединяются. "
        "Admin получает полный доступ."
    ),
    responses={200: {"description": "Права успешно получены"}},
)
# @IsAuthenticated
async def get_my_permissions(
    db: DbSession,
    decoded_token: CurrentUser,
) -> UserPermissionsResponse:
    return await get_user_permissions_or_raise(db, decoded_token)
