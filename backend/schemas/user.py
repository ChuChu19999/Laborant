from __future__ import annotations
from pydantic import BaseModel, ConfigDict


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    personnel_number: str | None = None
    department_number: int | None = None
    full_name: str | None = None
    ad_login: str | None = None
    email: str | None = None
    hsnils: str | None = None
    is_staff: bool = False
