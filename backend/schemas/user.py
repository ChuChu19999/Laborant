from typing import Optional
from pydantic import BaseModel


class UserResponse(BaseModel):
    personnel_number: Optional[str] = None
    department_number: Optional[int] = None
    full_name: Optional[str] = None
    ad_login: Optional[str] = None
    email: Optional[str] = None
    hsnils: Optional[str] = None
    is_staff: bool = False

    class Config:
        from_attributes = True
