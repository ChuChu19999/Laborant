from sqlalchemy import (
    JSON,
    Column,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    text,
)
from sqlalchemy.orm import relationship
from core.config import get_database_schema
from models.base import BaseModel


class Sample(BaseModel):
    __tablename__ = "samples"

    id = Column(Integer, primary_key=True, autoincrement=True)

    registration_number = Column(
        String(50), nullable=False, index=True, comment="Регистрационный номер пробы"
    )
    test_object = Column(String(255), nullable=False, comment="Объект испытаний")
    sampling_date = Column(Date, nullable=True, comment="Дата отбора пробы")
    receiving_date = Column(
        Date, nullable=True, comment="Дата получения пробы в лабораторию"
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
    branch_id = Column(
        Integer,
        ForeignKey(f"{get_database_schema()}.branches.id", ondelete="SET NULL"),
        nullable=True,
    )
    sampling_location_id = Column(
        Integer,
        ForeignKey(
            f"{get_database_schema()}.sampling_locations.id", ondelete="SET NULL"
        ),
        nullable=True,
    )
    well = Column(String(255), nullable=True, comment="Название скважины")
    mode = Column(String(255), nullable=True, comment="Режим работы скважины")
    phone = Column(String(50), nullable=True, comment="Номер телефона филиала")
    selection_conditions = Column(
        JSON, nullable=True, comment="JSON с условиями отбора и их значениями"
    )

    laboratory = relationship("Laboratory", back_populates="samples")
    department = relationship("Department", back_populates="samples")
    branch = relationship("Branch", back_populates="samples")
    sampling_location = relationship("SamplingLocation", back_populates="samples")
    calculations = relationship("Calculation", back_populates="sample")

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
        Index("idx_sample_created_at", "created_at"),
        Index("idx_sample_updated_at", "updated_at"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<Sample(id={self.id}, registration_number='{self.registration_number}', laboratory_id={self.laboratory_id})>"


class SelectionConditions(BaseModel):
    __tablename__ = "selection_conditions"

    id = Column(Integer, primary_key=True, autoincrement=True)

    conditions = Column(
        JSON,
        nullable=False,
        default=list,
        comment="JSON с условиями отбора и их единицами измерения",
    )
    laboratory_id = Column(
        Integer,
        ForeignKey(f"{get_database_schema()}.laboratories.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    department_id = Column(
        Integer,
        ForeignKey(f"{get_database_schema()}.departments.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    laboratory = relationship("Laboratory", back_populates="selection_conditions")
    department = relationship("Department", back_populates="selection_conditions")

    __table_args__ = (
        Index("idx_selection_conditions_laboratory", "laboratory_id"),
        Index("idx_selection_conditions_department", "department_id"),
        Index("idx_selection_conditions_created_at", "created_at"),
        Index("idx_selection_conditions_updated_at", "updated_at"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<SelectionConditions(id={self.id}, laboratory_id={self.laboratory_id}, department_id={self.department_id})>"


class MassFractionOilRefractionTable(BaseModel):
    __tablename__ = "mass_fraction_oil_refraction_tables"

    id = Column(Integer, primary_key=True, autoincrement=True)

    research_method_id = Column(
        Integer,
        ForeignKey(f"{get_database_schema()}.research_methods.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    c_value = Column(
        String(10),
        nullable=False,
        index=True,
        comment="Массовая доля нефти (C) в процентах",
    )
    n_value = Column(String(10), nullable=False, comment="Показатель преломления (n)")

    research_method = relationship("ResearchMethod", back_populates="refraction_tables")

    __table_args__ = (
        Index(
            "idx_refraction_table_research_method_c", "research_method_id", "c_value"
        ),
        Index("idx_refraction_table_created_at", "created_at"),
        Index("idx_refraction_table_updated_at", "updated_at"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<MassFractionOilRefractionTable(id={self.id}, research_method_id={self.research_method_id}, c_value={self.c_value}, n_value={self.n_value})>"
