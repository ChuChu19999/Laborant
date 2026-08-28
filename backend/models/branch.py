from __future__ import annotations
from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.config import get_database_schema
from models.base import BaseModel

if TYPE_CHECKING:
    from models.department import Department
    from models.laboratory import Laboratory
    from models.sample import Sample
    from models.sampling_location import SamplingLocation
    from models.well_mode import WellMode


class Branch(BaseModel):
    __tablename__ = "branches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(String(255), nullable=False, comment="Название филиала")
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True, comment="Номер телефона филиала")
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

    laboratory: Mapped["Laboratory"] = relationship(back_populates="branches")
    department: Mapped["Department | None"] = relationship(back_populates="branches")
    sampling_locations: Mapped[list["SamplingLocation"]] = relationship(back_populates="branch")
    well_modes: Mapped[list["WellMode"]] = relationship(back_populates="branch")
    samples: Mapped[list["Sample"]] = relationship(back_populates="branch")

    __table_args__ = (
        Index("idx_branch_name", "name"),
        Index("idx_branch_laboratory", "laboratory_id"),
        Index("idx_branch_department", "department_id"),
        {"schema": get_database_schema()},
    )

    def __repr__(self) -> str:
        return f"<Branch(id={self.id}, name='{self.name}', laboratory_id={self.laboratory_id})>"
