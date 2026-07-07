from __future__ import annotations
from datetime import date
from typing import TYPE_CHECKING, Any, Optional
from sqlalchemy import JSON, Date, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.config import get_database_schema
from models.base import BaseModel

if TYPE_CHECKING:
    from models.laboratory import Department, Laboratory
    from models.research import ResearchMethod
    from models.sample import Sample


class Calculation(BaseModel):
    __tablename__ = "calculations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    input_data: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=dict, comment="Входные данные для расчета"
    )
    equipment_data: Mapped[Optional[list[Any]]] = mapped_column(
        JSON, nullable=True, default=list, comment="Список ID приборов"
    )
    result: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Итоговый результат расчета"
    )
    executor: Mapped[str] = mapped_column(
        String(150), nullable=False, comment="hsnils исполнителя, производившего расчет"
    )
    measurement_error: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        comment="Погрешность измерения результата в формате ±число",
    )
    unit: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, comment="Единица измерения результата"
    )
    laboratory_activity_date: Mapped[date] = mapped_column(
        Date, nullable=False, comment="Дата проведения лабораторного исследования"
    )
    sample_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.samples.id", ondelete="CASCADE"),
        nullable=False,
    )
    laboratory_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.laboratories.id", ondelete="CASCADE"),
        nullable=False,
    )
    department_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.departments.id", ondelete="CASCADE"),
        nullable=True,
    )
    research_method_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.research_methods.id", ondelete="RESTRICT"),
        nullable=False,
    )

    sample: Mapped["Sample"] = relationship(back_populates="calculations")
    laboratory: Mapped["Laboratory"] = relationship(back_populates="calculations")
    department: Mapped[Optional["Department"]] = relationship(
        back_populates="calculations"
    )
    research_method: Mapped["ResearchMethod"] = relationship(
        back_populates="calculations"
    )

    __table_args__ = (
        Index(
            "unique_sample_method",
            "sample_id",
            "research_method_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("idx_calculation_sample", "sample_id"),
        Index("idx_calculation_laboratory", "laboratory_id"),
        Index("idx_calculation_department", "department_id"),
        Index("idx_calculation_research_method", "research_method_id"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<Calculation(id={self.id}, sample_id={self.sample_id}, research_method_id={self.research_method_id})>"
