from __future__ import annotations
from typing import TYPE_CHECKING
from sqlalchemy import Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.config import get_database_schema
from models.base import BaseModel

if TYPE_CHECKING:
    from models.branch import Branch
    from models.calculation import Calculation
    from models.department import Department
    from models.equipment import Equipment
    from models.nd_norm import NdNorm
    from models.protocol import Protocol, ProtocolTemplate
    from models.report import ReportTemplate
    from models.research import ResearchMethod
    from models.sample import Sample
    from models.sample_type import SampleType
    from models.selection_conditions import SelectionConditions
    from models.test_purpose import TestPurpose


class Laboratory(BaseModel):
    __tablename__ = "laboratories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="Аббревиатура")
    full_name: Mapped[str] = mapped_column(String(255), nullable=False, comment="Полное название")
    laboratory_location: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="Место осуществления лабораторной деятельности",
    )

    departments: Mapped[list["Department"]] = relationship(back_populates="laboratory")
    branches: Mapped[list["Branch"]] = relationship(back_populates="laboratory")
    samples: Mapped[list["Sample"]] = relationship(back_populates="laboratory")
    protocols: Mapped[list["Protocol"]] = relationship(back_populates="laboratory")
    calculations: Mapped[list["Calculation"]] = relationship(back_populates="laboratory")
    equipment: Mapped[list["Equipment"]] = relationship(back_populates="laboratory")
    nd_norms: Mapped[list["NdNorm"]] = relationship(back_populates="laboratory")
    sample_types: Mapped[list["SampleType"]] = relationship(back_populates="laboratory")
    test_purposes: Mapped[list["TestPurpose"]] = relationship(back_populates="laboratory")
    selection_conditions: Mapped[list["SelectionConditions"]] = relationship(back_populates="laboratory")
    protocol_templates: Mapped[list["ProtocolTemplate"]] = relationship(back_populates="laboratory")
    report_templates: Mapped[list["ReportTemplate"]] = relationship(back_populates="laboratory")
    research_methods: Mapped[list["ResearchMethod"]] = relationship(back_populates="laboratory")

    __table_args__ = (
        Index(
            "unique_laboratory_name",
            "name",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        {"schema": get_database_schema()},
    )

    def __repr__(self) -> str:
        return f"<Laboratory(id={self.id}, name='{self.name}', full_name='{self.full_name}')>"
