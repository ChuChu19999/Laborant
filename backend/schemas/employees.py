from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class EmployeesByHsnilsRequest(BaseModel):
    """Запрос на получение сотрудников по списку hsnils."""

    hsnils: list[str]
    includePhoto: Optional[bool] = False
