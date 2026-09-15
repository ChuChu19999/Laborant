from __future__ import annotations
from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.config import get_database_schema
from models.base import BaseModel

if TYPE_CHECKING:
    from models.department import Department
    from models.laboratory import Laboratory


class TestPurpose(BaseModel):
    __tablename__ = "test_purposes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, comment="Название цели испытаний")
    laboratory_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.laboratories.id", ondelete="CASCADE"),
        nullable=False,
        comment="ID лаборатории",
    )
    department_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.departments.id", ondelete="CASCADE"),
        nullable=True,
        comment="ID подразделения",
    )

    laboratory: Mapped["Laboratory"] = relationship(back_populates="test_purposes")
    department: Mapped["Department | None"] = relationship(back_populates="test_purposes")

    __table_args__ = (
        Index(
            "unique_test_purpose_name_lab",
            "laboratory_id",
            "name",
            unique=True,
            postgresql_where=text("deleted_at IS NULL AND department_id IS NULL"),
        ),
        Index(
            "unique_test_purpose_name_lab_dept",
            "laboratory_id",
            "department_id",
            "name",
            unique=True,
            postgresql_where=text("deleted_at IS NULL AND department_id IS NOT NULL"),
        ),
        Index("idx_test_purpose_laboratory", "laboratory_id"),
        Index("idx_test_purpose_department", "department_id"),
        {"schema": get_database_schema()},
    )

    def __repr__(self) -> str:
        return f"<TestPurpose(id={self.id}, name='{self.name}')>"
