from enum import Enum as PyEnum
from sqlalchemy import JSON, Column, Index, Integer, String, text
from core.config import get_database_schema
from models.base import BaseModel


class RoleType(PyEnum):
    LABORANT = "laborant"
    ENGINEER = "engineer"


class Role(BaseModel):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(
        String(255),
        nullable=False,
        index=True,
        comment="Наименование роли",
    )
    role_type = Column(
        String(20),
        nullable=False,
        index=True,
        comment="Тип роли: laborant, engineer",
    )
    visibility_scope = Column(
        JSON,
        nullable=False,
        default=lambda: {"laboratory_ids": [], "department_ids": []},
        comment="Область видимости: laboratory_ids, department_ids",
    )

    __table_args__ = (
        Index(
            "unique_role_name_type",
            "name",
            "role_type",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("idx_role_created_at", "created_at"),
        Index("idx_role_updated_at", "updated_at"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<Role(id={self.id}, name='{self.name}', role_type='{self.role_type}')>"
