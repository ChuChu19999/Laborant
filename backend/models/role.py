from __future__ import annotations
from enum import Enum as PyEnum
from typing import Any
from sqlalchemy import JSON, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column
from core.config import get_database_schema
from models.base import BaseModel


class RoleType(PyEnum):
    LABORANT = "laborant"
    ENGINEER = "engineer"


class Role(BaseModel):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Наименование роли",
    )
    role_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Тип роли: laborant, engineer",
    )
    scopes: Mapped[list[Any]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        comment="Привязки: laboratory_id, department_id, permissions",
    )

    __table_args__ = (
        Index(
            "unique_role_name_type",
            "name",
            "role_type",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<Role(id={self.id}, name='{self.name}', role_type='{self.role_type}')>"
