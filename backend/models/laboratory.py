from sqlalchemy import Column, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import relationship
from core.config import get_database_schema
from models.base import BaseModel


class Laboratory(BaseModel):
    __tablename__ = "laboratories"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String(100), nullable=False, index=True, comment="Аббревиатура")
    full_name = Column(String(255), nullable=False, comment="Полное название")
    laboratory_location = Column(
        String(255),
        nullable=True,
        comment="Место осуществления лабораторной деятельности",
    )

    departments = relationship(
        "Department", back_populates="laboratory", cascade="all, delete-orphan"
    )
    branches = relationship(
        "Branch", back_populates="laboratory", cascade="all, delete-orphan"
    )
    samples = relationship("Sample", back_populates="laboratory")
    protocols = relationship("Protocol", back_populates="laboratory")
    calculations = relationship("Calculation", back_populates="laboratory")
    equipment = relationship("Equipment", back_populates="laboratory")
    nd_norms = relationship("NdNorm", back_populates="laboratory")
    selection_conditions = relationship(
        "SelectionConditions", back_populates="laboratory"
    )
    protocol_templates = relationship("ProtocolTemplate", back_populates="laboratory")
    report_templates = relationship("ReportTemplate", back_populates="laboratory")
    research_methods = relationship("ResearchMethod", back_populates="laboratory")

    __table_args__ = (
        Index(
            "unique_laboratory_name",
            "name",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("idx_laboratory_name", "name"),
        Index("idx_laboratory_created_at", "created_at"),
        Index("idx_laboratory_updated_at", "updated_at"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<Laboratory(id={self.id}, name='{self.name}', full_name='{self.full_name}')>"


class Department(BaseModel):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, autoincrement=True)

    laboratory_id = Column(
        Integer,
        ForeignKey(f"{get_database_schema()}.laboratories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(100), nullable=False, comment="Название подразделения")
    laboratory_location = Column(
        String(255),
        nullable=False,
        comment="Место осуществления лабораторной деятельности",
    )

    laboratory = relationship("Laboratory", back_populates="departments")
    branches = relationship(
        "Branch", back_populates="department", cascade="all, delete-orphan"
    )
    samples = relationship("Sample", back_populates="department")
    protocols = relationship("Protocol", back_populates="department")
    calculations = relationship("Calculation", back_populates="department")
    equipment = relationship("Equipment", back_populates="department")
    nd_norms = relationship("NdNorm", back_populates="department")
    selection_conditions = relationship(
        "SelectionConditions", back_populates="department"
    )
    protocol_templates = relationship("ProtocolTemplate", back_populates="department")
    report_templates = relationship("ReportTemplate", back_populates="department")
    research_methods = relationship("ResearchMethod", back_populates="department")

    __table_args__ = (
        Index(
            "unique_department_name_per_laboratory",
            "laboratory_id",
            "name",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("idx_department_laboratory_name", "laboratory_id", "name"),
        Index("idx_department_created_at", "created_at"),
        Index("idx_department_updated_at", "updated_at"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<Department(id={self.id}, name='{self.name}', laboratory_id={self.laboratory_id})>"


class Branch(BaseModel):
    __tablename__ = "branches"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String(255), nullable=False, index=True, comment="Название филиала")
    phone = Column(String(20), nullable=True, comment="Номер телефона филиала")
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
    )

    laboratory = relationship("Laboratory", back_populates="branches")
    department = relationship("Department", back_populates="branches")
    sampling_locations = relationship(
        "SamplingLocation", back_populates="branch", cascade="all, delete-orphan"
    )
    well_modes = relationship(
        "WellMode", back_populates="branch", cascade="all, delete-orphan"
    )
    samples = relationship("Sample", back_populates="branch")

    __table_args__ = (
        Index("idx_branch_name", "name"),
        Index("idx_branch_laboratory", "laboratory_id"),
        Index("idx_branch_department", "department_id"),
        Index("idx_branch_created_at", "created_at"),
        Index("idx_branch_updated_at", "updated_at"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<Branch(id={self.id}, name='{self.name}', laboratory_id={self.laboratory_id})>"


class SamplingLocation(BaseModel):
    __tablename__ = "sampling_locations"

    id = Column(Integer, primary_key=True, autoincrement=True)

    branch_id = Column(
        Integer,
        ForeignKey(f"{get_database_schema()}.branches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(
        String(255), nullable=False, index=True, comment="Название места отбора пробы"
    )

    branch = relationship("Branch", back_populates="sampling_locations")
    samples = relationship("Sample", back_populates="sampling_location")

    __table_args__ = (
        Index(
            "unique_sampling_location_per_branch",
            "branch_id",
            "name",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("idx_sampling_location_branch_name", "branch_id", "name"),
        Index("idx_sampling_location_created_at", "created_at"),
        Index("idx_sampling_location_updated_at", "updated_at"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<SamplingLocation(id={self.id}, name='{self.name}', branch_id={self.branch_id})>"


class WellMode(BaseModel):
    __tablename__ = "well_modes"

    id = Column(Integer, primary_key=True, autoincrement=True)

    branch_id = Column(
        Integer,
        ForeignKey(f"{get_database_schema()}.branches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(
        String(255), nullable=False, index=True, comment="Название режима скважины"
    )

    branch = relationship("Branch", back_populates="well_modes")

    __table_args__ = (
        Index(
            "unique_well_mode_per_branch",
            "branch_id",
            "name",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("idx_well_mode_branch_name", "branch_id", "name"),
        Index("idx_well_mode_created_at", "created_at"),
        Index("idx_well_mode_updated_at", "updated_at"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return (
            f"<WellMode(id={self.id}, name='{self.name}', branch_id={self.branch_id})>"
        )
