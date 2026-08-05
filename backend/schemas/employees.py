from __future__ import annotations
from pydantic import BaseModel


class EmployeesByHsnilsRequest(BaseModel):
    """Запрос на получение сотрудников по списку hsnils."""

    hsnils: list[str]
    includePhoto: bool = False
