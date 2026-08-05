from __future__ import annotations
from enum import Enum as PyEnum
from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.config import get_database_schema
from models.base import BaseModel

if TYPE_CHECKING:
    from models.laboratory import Department, Laboratory


class ReportType(PyEnum):
    SAMPLE_COUNT = "Количество проб"
    PHYSICOCHEMICAL_CHARACTERISTIC = "Физико-химическая характеристика"
    KGS_RESULTS = "Результаты КГС"
    NKS_RESULTS = "Результаты НКС"


class ReportTemplate(BaseModel):
    __tablename__ = "report_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    report_type: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Тип отчета",
    )
    version: Mapped[str] = mapped_column(
        String(8), nullable=False, comment="Версия шаблона (например, v1)"
    )
    file: Mapped[str] = mapped_column(String, nullable=False, comment="Файл (base64)")
    file_name: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="Имя файла"
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

    laboratory: Mapped["Laboratory"] = relationship(back_populates="report_templates")
    department: Mapped["Department | None"] = relationship(
        back_populates="report_templates"
    )

    __table_args__ = (
        Index("idx_report_template_type", "report_type"),
        Index("idx_report_template_laboratory", "laboratory_id"),
        Index("idx_report_template_department", "department_id"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<ReportTemplate(id={self.id}, report_type='{self.report_type}', version='{self.version}')>"
