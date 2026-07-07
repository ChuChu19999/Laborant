from __future__ import annotations
from typing import Any
from sqlalchemy import JSON, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column
from core.config import get_database_schema
from models.base import BaseModel


class TestObject(BaseModel):
    __tablename__ = "test_objects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Наименование объекта испытаний",
    )
    tag: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Тег для связи с методами исследования",
    )
    visibility_scope: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        default=lambda: {"laboratory_ids": [], "department_ids": []},
        comment="Область видимости: laboratory_ids, department_ids",
    )

    __table_args__ = (
        Index(
            "unique_test_object_name",
            "name",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("idx_test_object_tag", "tag"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<TestObject(id={self.id}, name='{self.name}', tag='{self.tag}')>"
