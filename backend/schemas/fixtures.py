from __future__ import annotations
from pydantic import BaseModel, ConfigDict, Field


class FixtureDirectoryEntry(BaseModel):
    """Каталог (или группа каталогов) фикстур лаборатории."""

    path: str = Field(..., description="Основной относительный путь каталога")
    paths: list[str] = Field(default_factory=list, description="Все пути группы с одной меткой")
    label: str = Field(..., description="Отображаемое название для дерева")


class FixtureDirectoriesResponse(BaseModel):
    """Ответ со списком каталогов фикстур."""

    directories: list[FixtureDirectoryEntry]


class FixturesListResponse(BaseModel):
    """Ответ со списком доступных путей фикстур."""

    fixtures: list[str]


class FixtureFilesResponse(BaseModel):
    """Ответ со списком файлов в каталоге фикстур."""

    files: list[str]


class FixtureDataResponse(BaseModel):
    """Данные JSON-фикстуры метода исследования (произвольная структура)."""

    model_config = ConfigDict(extra="allow")


class SavedMethodEntry(BaseModel):
    """Метод в дереве сохранённых методик."""

    id: int
    name: str
    nd_code: str = ""
    group_name: str | None = None


class SavedDepartmentBlock(BaseModel):
    """Блок подразделения в дереве сохранённых методик."""

    department_id: int
    department_name: str
    methods: list[SavedMethodEntry]


class SavedLaboratoryBlock(BaseModel):
    """Блок лаборатории в дереве сохранённых методик."""

    laboratory_id: int | None
    laboratory_name: str
    departments: list[SavedDepartmentBlock]
    methods_without_department: list[SavedMethodEntry]


class SavedMethodsTreeResponse(BaseModel):
    """Дерево расчётных методов по лабораториям и подразделениям."""

    laboratories: list[SavedLaboratoryBlock]
