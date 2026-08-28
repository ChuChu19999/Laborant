from __future__ import annotations
from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.config import get_database_schema
from models.base import BaseModel

if TYPE_CHECKING:
    from models.branch import Branch
    from models.sample import Sample


class SamplingLocation(BaseModel):
    __tablename__ = "sampling_locations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    branch_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.branches.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, comment="Название места отбора пробы")

    branch: Mapped["Branch"] = relationship(back_populates="sampling_locations")
    samples: Mapped[list["Sample"]] = relationship(back_populates="sampling_location")

    __table_args__ = (
        Index(
            "unique_sampling_location_per_branch",
            "branch_id",
            "name",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        {"schema": get_database_schema()},
    )

    def __repr__(self) -> str:
        return f"<SamplingLocation(id={self.id}, name='{self.name}', branch_id={self.branch_id})>"
