from __future__ import annotations
from typing import TYPE_CHECKING, Any
from sqlalchemy import JSON, ForeignKey, Index, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.config import get_database_schema
from models.base import BaseModel

if TYPE_CHECKING:
    from models.department import Department
    from models.laboratory import Laboratory


class SelectionConditions(BaseModel):
    __tablename__ = "selection_conditions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    conditions: Mapped[list[Any]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        comment="JSON с условиями отбора и их единицами измерения",
    )
    laboratory_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.laboratories.id", ondelete="CASCADE"),
        nullable=True,
    )
    department_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.departments.id", ondelete="CASCADE"),
        nullable=True,
    )

    laboratory: Mapped["Laboratory | None"] = relationship(back_populates="selection_conditions")
    department: Mapped["Department | None"] = relationship(back_populates="selection_conditions")

    __table_args__ = (
        Index("idx_selection_conditions_laboratory", "laboratory_id"),
        Index("idx_selection_conditions_department", "department_id"),
        {"schema": get_database_schema()},
    )

    def __repr__(self) -> str:
        return f"<SelectionConditions(id={self.id}, laboratory_id={self.laboratory_id}, department_id={self.department_id})>"
