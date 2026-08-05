from __future__ import annotations
from fastapi import APIRouter, Depends
from core.auth_decorators import IsAuthenticated
from core.deps import DbSession
from core.security import get_current_user
from schemas.role import UserPermissionsResponse
from services.user_permissions import resolve_user_permissions

router = APIRouter()


@router.get(
    "/user-roles/me/",
    response_model=UserPermissionsResponse,
    summary="Права текущего пользователя",
    description=(
        "Возвращает права доступа по ролям из токена "
        "и справочника ролей. Несколько ролей объединяются "
        "Admin получает полный доступ."
    ),
    responses={200: {"description": "Права успешно получены"}},
)
# @IsAuthenticated
async def get_my_permissions(
    db: DbSession,
    decoded_token: dict = Depends(get_current_user),
):
    """Возвращает права текущего пользователя."""
    return await resolve_user_permissions(db, decoded_token)
