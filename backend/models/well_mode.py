from __future__ import annotations
from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.config import get_database_schema
from models.base import BaseModel

if TYPE_CHECKING:
    from models.branch import Branch


class WellMode(BaseModel):
    __tablename__ = "well_modes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    branch_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.branches.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, comment="Название режима скважины")

    branch: Mapped["Branch"] = relationship(back_populates="well_modes")

    __table_args__ = (
        Index(
            "unique_well_mode_per_branch",
            "branch_id",
            "name",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        {"schema": get_database_schema()},
    )

    def __repr__(self) -> str:
        return f"<WellMode(id={self.id}, name='{self.name}', branch_id={self.branch_id})>"
