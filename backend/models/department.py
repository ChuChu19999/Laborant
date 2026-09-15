from __future__ import annotations
from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, Index, Integer, String, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.config import get_database_schema
from models.base import BaseModel

if TYPE_CHECKING:
    from models.branch import Branch
    from models.calculation import Calculation
    from models.equipment import Equipment
    from models.laboratory import Laboratory
    from models.nd_norm import NdNorm
    from models.protocol import Protocol, ProtocolTemplate
    from models.report import ReportTemplate
    from models.research import ResearchMethod
    from models.sample import Sample
    from models.sample_type import SampleType
    from models.selection_conditions import SelectionConditions
    from models.test_purpose import TestPurpose


class Department(BaseModel):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    laboratory_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.laboratories.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="Название подразделения")
    laboratory_location: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Место осуществления лабораторной деятельности",
    )

    laboratory: Mapped["Laboratory"] = relationship(back_populates="departments")
    branches: Mapped[list["Branch"]] = relationship(back_populates="department")
    samples: Mapped[list["Sample"]] = relationship(back_populates="department")
    protocols: Mapped[list["Protocol"]] = relationship(back_populates="department")
    calculations: Mapped[list["Calculation"]] = relationship(back_populates="department")
    equipment: Mapped[list["Equipment"]] = relationship(back_populates="department")
    nd_norms: Mapped[list["NdNorm"]] = relationship(back_populates="department")
    sample_types: Mapped[list["SampleType"]] = relationship(back_populates="department")
    test_purposes: Mapped[list["TestPurpose"]] = relationship(back_populates="department")
    selection_conditions: Mapped[list["SelectionConditions"]] = relationship(back_populates="department")
    protocol_templates: Mapped[list["ProtocolTemplate"]] = relationship(back_populates="department")
    report_templates: Mapped[list["ReportTemplate"]] = relationship(back_populates="department")
    research_methods: Mapped[list["ResearchMethod"]] = relationship(back_populates="department")

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

    def __repr__(self) -> str:
        try:
            return f"<Department(id={self.id}, name='{self.name}', laboratory_id={self.laboratory_id})>"
        except (AttributeError, SQLAlchemyError):
            return f"<Department at 0x{id(self):x}>"
