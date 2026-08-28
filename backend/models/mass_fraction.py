from __future__ import annotations
from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.config import get_database_schema
from models.base import BaseModel

if TYPE_CHECKING:
    from models.research import ResearchMethod


class MassFractionOilRefractionTable(BaseModel):
    __tablename__ = "mass_fraction_oil_refraction_tables"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    research_method_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.research_methods.id", ondelete="CASCADE"),
        nullable=False,
    )
    c_value: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        comment="Массовая доля нефти (C) в процентах",
    )
    n_value: Mapped[str] = mapped_column(String(10), nullable=False, comment="Показатель преломления (n)")

    research_method: Mapped["ResearchMethod"] = relationship(back_populates="refraction_tables")

    __table_args__ = (
        Index("idx_refraction_table_research_method_c", "research_method_id", "c_value"),
        {"schema": get_database_schema()},
    )

    def __repr__(self) -> str:
        return (
            f"<MassFractionOilRefractionTable(id={self.id}, "
            f"research_method_id={self.research_method_id}, "
            f"c_value={self.c_value}, n_value={self.n_value})>"
        )
