from __future__ import annotations
from typing import TYPE_CHECKING, Any
from sqlalchemy import JSON, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.config import get_database_schema
from models.base import BaseModel

if TYPE_CHECKING:
    from models.laboratory import Department, Laboratory


class NdNorm(BaseModel):
    __tablename__ = "nd_norms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Наименование нормы",
    )
    test_object: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Объект испытаний",
    )
    laboratory_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.laboratories.id", ondelete="CASCADE"),
        nullable=False,
    )
    department_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.departments.id", ondelete="CASCADE"),
        nullable=True,
    )
    method_data: Mapped[list[Any]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        comment="Значения нормы по методам: method_id и value",
    )

    laboratory: Mapped["Laboratory"] = relationship(back_populates="nd_norms")
    department: Mapped["Department | None"] = relationship(back_populates="nd_norms")

    __table_args__ = (
        Index("idx_nd_norm_name", "name"),
        Index("idx_nd_norm_test_object", "test_object"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return (
            f"<NdNorm(id={self.id}, name='{self.name}', "
            f"laboratory_id={self.laboratory_id})>"
        )
