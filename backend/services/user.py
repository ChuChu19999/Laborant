from schemas.user import UserResponse


def get_user_from_token(decoded_token: dict) -> UserResponse:
    """Преобразование JWT токена в информацию о пользователе."""
    return UserResponse(
        personnel_number=decoded_token.get("personnelNumber"),
        department_number=decoded_token.get("departmentNumber"),
        full_name=decoded_token.get("fullName"),
        ad_login=decoded_token.get("preferred_username"),
        email=decoded_token.get("email"),
        hsnils=decoded_token.get("hashSnils"),
        is_staff=False,
    )
