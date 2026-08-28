from __future__ import annotations
from schemas.user import UserResponse


def build_user_response_from_token(decoded_token: dict) -> UserResponse:
    """Собрать UserResponse из полей JWT-токена."""
    return UserResponse(
        personnel_number=decoded_token.get("personnelNumber"),
        department_number=decoded_token.get("departmentNumber"),
        full_name=decoded_token.get("fullName"),
        ad_login=decoded_token.get("preferred_username"),
        email=decoded_token.get("email"),
        hsnils=decoded_token.get("hashSnils"),
        is_staff=False,
    )
