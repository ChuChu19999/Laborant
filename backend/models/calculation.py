from sqlalchemy import (
    JSON,
    Column,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.orm import relationship
from core.config import get_database_schema
from models.base import BaseModel


class Calculation(BaseModel):
    __tablename__ = "calculations"

    id = Column(Integer, primary_key=True, autoincrement=True)

    input_data = Column(
        JSON, nullable=False, default=dict, comment="Входные данные для расчета"
    )
    equipment_data = Column(
        JSON, nullable=True, default=list, comment="Список ID приборов"
    )
    result = Column(Text, nullable=False, comment="Итоговый результат расчета")
    executor = Column(
        String(150), nullable=False, comment="hsnils исполнителя, производившего расчет"
    )
    measurement_error = Column(
        String(20),
        nullable=True,
        comment="Погрешность измерения результата в формате ±число",
    )
    unit = Column(String(20), nullable=True, comment="Единица измерения результата")
    laboratory_activity_date = Column(
        Date, nullable=False, comment="Дата проведения лабораторного исследования"
    )
    sample_id = Column(
        Integer,
        ForeignKey(f"{get_database_schema()}.samples.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    laboratory_id = Column(
        Integer,
        ForeignKey(f"{get_database_schema()}.laboratories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    department_id = Column(
        Integer,
        ForeignKey(f"{get_database_schema()}.departments.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    research_method_id = Column(
        Integer,
        ForeignKey(f"{get_database_schema()}.research_methods.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    sample = relationship("Sample", back_populates="calculations")
    laboratory = relationship("Laboratory", back_populates="calculations")
    department = relationship("Department", back_populates="calculations")
    research_method = relationship("ResearchMethod", back_populates="calculations")

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
        Index("idx_calculation_created_at", "created_at"),
        Index("idx_calculation_updated_at", "updated_at"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<Calculation(id={self.id}, sample_id={self.sample_id}, research_method_id={self.research_method_id})>"
