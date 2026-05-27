from enum import Enum as PyEnum
from sqlalchemy import Column, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship
from core.config import get_database_schema
from models.base import BaseModel


class ReportType(PyEnum):
    SAMPLE_COUNT = "Количество проб"
    PHYSICOCHEMICAL_CHARACTERISTIC = "Физико-химическая характеристика"
    KGS_RESULTS = "Результаты КГС"
    NKS_RESULTS = "Результаты НКС"


class ReportTemplate(BaseModel):
    __tablename__ = "report_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)

    report_type = Column(
        String(255),
        nullable=False,
        index=True,
        comment="Тип отчета",
    )
    version = Column(String(8), nullable=False, comment="Версия шаблона (например, v1)")
    file = Column(String, nullable=False, comment="Файл (base64)")
    file_name = Column(String(255), nullable=False, comment="Оригинальное имя файла")
    laboratory_id = Column(
        Integer,
        ForeignKey(f"{get_database_schema()}.laboratories.id", ondelete="CASCADE"),
        nullable=False,
    )
    department_id = Column(
        Integer,
        ForeignKey(f"{get_database_schema()}.departments.id", ondelete="CASCADE"),
        nullable=True,
    )

    laboratory = relationship("Laboratory", back_populates="report_templates")
    department = relationship("Department", back_populates="report_templates")

    __table_args__ = (
        Index("idx_report_template_type", "report_type"),
        Index("idx_report_template_laboratory", "laboratory_id"),
        Index("idx_report_template_department", "department_id"),
        Index("idx_report_template_created_at", "created_at"),
        Index("idx_report_template_updated_at", "updated_at"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<ReportTemplate(id={self.id}, report_type='{self.report_type}', version='{self.version}')>"
