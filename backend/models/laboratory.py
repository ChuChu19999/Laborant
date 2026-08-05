from __future__ import annotations
from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.config import get_database_schema
from models.base import BaseModel

if TYPE_CHECKING:
    from models.calculation import Calculation
    from models.equipment import Equipment
    from models.nd_norm import NdNorm
    from models.protocol import Protocol, ProtocolTemplate
    from models.report import ReportTemplate
    from models.research import ResearchMethod
    from models.sample import Sample, SelectionConditions


class Laboratory(BaseModel):
    __tablename__ = "laboratories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="Аббревиатура"
    )
    full_name: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="Полное название"
    )
    laboratory_location: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="Место осуществления лабораторной деятельности",
    )

    departments: Mapped[list["Department"]] = relationship(back_populates="laboratory")
    branches: Mapped[list["Branch"]] = relationship(back_populates="laboratory")
    samples: Mapped[list["Sample"]] = relationship(back_populates="laboratory")
    protocols: Mapped[list["Protocol"]] = relationship(back_populates="laboratory")
    calculations: Mapped[list["Calculation"]] = relationship(
        back_populates="laboratory"
    )
    equipment: Mapped[list["Equipment"]] = relationship(back_populates="laboratory")
    nd_norms: Mapped[list["NdNorm"]] = relationship(back_populates="laboratory")
    selection_conditions: Mapped[list["SelectionConditions"]] = relationship(
        back_populates="laboratory"
    )
    protocol_templates: Mapped[list["ProtocolTemplate"]] = relationship(
        back_populates="laboratory"
    )
    report_templates: Mapped[list["ReportTemplate"]] = relationship(
        back_populates="laboratory"
    )
    research_methods: Mapped[list["ResearchMethod"]] = relationship(
        back_populates="laboratory"
    )

    __table_args__ = (
        Index(
            "unique_laboratory_name",
            "name",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<Laboratory(id={self.id}, name='{self.name}', full_name='{self.full_name}')>"


class Department(BaseModel):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    laboratory_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.laboratories.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="Название подразделения"
    )
    laboratory_location: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Место осуществления лабораторной деятельности",
    )

    laboratory: Mapped["Laboratory"] = relationship(back_populates="departments")
    branches: Mapped[list["Branch"]] = relationship(back_populates="department")
    samples: Mapped[list["Sample"]] = relationship(back_populates="department")
    protocols: Mapped[list["Protocol"]] = relationship(back_populates="department")
    calculations: Mapped[list["Calculation"]] = relationship(
        back_populates="department"
    )
    equipment: Mapped[list["Equipment"]] = relationship(back_populates="department")
    nd_norms: Mapped[list["NdNorm"]] = relationship(back_populates="department")
    selection_conditions: Mapped[list["SelectionConditions"]] = relationship(
        back_populates="department"
    )
    protocol_templates: Mapped[list["ProtocolTemplate"]] = relationship(
        back_populates="department"
    )
    report_templates: Mapped[list["ReportTemplate"]] = relationship(
        back_populates="department"
    )
    research_methods: Mapped[list["ResearchMethod"]] = relationship(
        back_populates="department"
    )

    __table_args__ = (
        Index(
            "unique_department_name_per_laboratory",
            "laboratory_id",
            "name",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<Department(id={self.id}, name='{self.name}', laboratory_id={self.laboratory_id})>"


class Branch(BaseModel):
    __tablename__ = "branches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="Название филиала"
    )
    phone: Mapped[str | None] = mapped_column(
        String(20), nullable=True, comment="Номер телефона филиала"
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

    laboratory: Mapped["Laboratory"] = relationship(back_populates="branches")
    department: Mapped["Department | None"] = relationship(back_populates="branches")
    sampling_locations: Mapped[list["SamplingLocation"]] = relationship(
        "SamplingLocation", back_populates="branch"
    )
    well_modes: Mapped[list["WellMode"]] = relationship(
        "WellMode", back_populates="branch"
    )
    samples: Mapped[list["Sample"]] = relationship(back_populates="branch")

    __table_args__ = (
        Index("idx_branch_name", "name"),
        Index("idx_branch_laboratory", "laboratory_id"),
        Index("idx_branch_department", "department_id"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<Branch(id={self.id}, name='{self.name}', laboratory_id={self.laboratory_id})>"


class SamplingLocation(BaseModel):
    __tablename__ = "sampling_locations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    branch_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.branches.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="Название места отбора пробы"
    )

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

    def __repr__(self):
        return f"<SamplingLocation(id={self.id}, name='{self.name}', branch_id={self.branch_id})>"


class WellMode(BaseModel):
    __tablename__ = "well_modes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    branch_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.branches.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="Название режима скважины"
    )

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

    def __repr__(self):
        return (
            f"<WellMode(id={self.id}, name='{self.name}', branch_id={self.branch_id})>"
        )
