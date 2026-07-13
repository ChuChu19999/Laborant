from __future__ import annotations
from datetime import date
from typing import TYPE_CHECKING, Any, Optional
from sqlalchemy import JSON, Date, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.config import get_database_schema
from models.base import BaseModel

if TYPE_CHECKING:
    from models.calculation import Calculation
    from models.laboratory import Branch, Department, Laboratory, SamplingLocation
    from models.research import ResearchMethod


class Sample(BaseModel):
    __tablename__ = "samples"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    registration_number: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="Регистрационный номер пробы"
    )
    sample_type: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="Тип пробы"
    )
    test_object: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="Объект испытаний"
    )
    sampling_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="Дата отбора пробы"
    )
    receiving_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="Дата получения пробы в лабораторию"
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
    branch_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.branches.id", ondelete="SET NULL"),
        nullable=True,
    )
    sampling_location_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey(
            f"{get_database_schema()}.sampling_locations.id", ondelete="SET NULL"
        ),
        nullable=True,
    )
    well: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="Название скважины"
    )
    mode: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="Режим работы скважины"
    )
    indicators_count: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Количество показателей"
    )
    phone: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="Номер телефона филиала"
    )
    selection_conditions: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON, nullable=True, comment="JSON с условиями отбора и их значениями"
    )
    added_by: Mapped[Optional[str]] = mapped_column(
        String(150), nullable=True, comment="hsnils лица, добавившего пробу"
    )

    laboratory: Mapped["Laboratory"] = relationship(back_populates="samples")
    department: Mapped[Optional["Department"]] = relationship(back_populates="samples")
    branch: Mapped[Optional["Branch"]] = relationship(back_populates="samples")
    sampling_location: Mapped[Optional["SamplingLocation"]] = relationship(
        back_populates="samples"
    )
    calculations: Mapped[list["Calculation"]] = relationship(back_populates="sample")

    __table_args__ = (
        Index(
            "unique_sample_registration_number_per_lab_dept",
            "registration_number",
            "laboratory_id",
            "department_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("idx_sample_registration_number", "registration_number"),
        Index("idx_sample_laboratory", "laboratory_id"),
        Index("idx_sample_department", "department_id"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<Sample(id={self.id}, registration_number='{self.registration_number}', laboratory_id={self.laboratory_id})>"


class SelectionConditions(BaseModel):
    __tablename__ = "selection_conditions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    conditions: Mapped[list[Any]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        comment="JSON с условиями отбора и их единицами измерения",
    )
    laboratory_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.laboratories.id", ondelete="CASCADE"),
        nullable=True,
    )
    department_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.departments.id", ondelete="CASCADE"),
        nullable=True,
    )

    laboratory: Mapped[Optional["Laboratory"]] = relationship(
        back_populates="selection_conditions"
    )
    department: Mapped[Optional["Department"]] = relationship(
        back_populates="selection_conditions"
    )

    __table_args__ = (
        Index("idx_selection_conditions_laboratory", "laboratory_id"),
        Index("idx_selection_conditions_department", "department_id"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<SelectionConditions(id={self.id}, laboratory_id={self.laboratory_id}, department_id={self.department_id})>"


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
    n_value: Mapped[str] = mapped_column(
        String(10), nullable=False, comment="Показатель преломления (n)"
    )

    research_method: Mapped["ResearchMethod"] = relationship(
        back_populates="refraction_tables"
    )

    __table_args__ = (
        Index(
            "idx_refraction_table_research_method_c", "research_method_id", "c_value"
        ),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<MassFractionOilRefractionTable(id={self.id}, research_method_id={self.research_method_id}, c_value={self.c_value}, n_value={self.n_value})>"
