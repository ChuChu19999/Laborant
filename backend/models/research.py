from enum import Enum as PyEnum
from sqlalchemy import JSON, Boolean, Column, ForeignKey, Index, Integer, String, Table
from sqlalchemy.orm import relationship
from core.config import get_database_schema
from core.database import Base
from models.base import BaseModel


class RoundingType(PyEnum):
    DECIMAL = "decimal"
    SIGNIFICANT = "significant"


class SampleType(PyEnum):
    OIL = "oil"
    OIL_CALIBRATION = "oil_calibration"
    CONDENSATE = "condensate"
    OIL_CONDENSATE_MIXTURE = "oil_condensate_mixture"
    DIESEL_FUEL = "diesel_fuel"
    SPENT_OIL_PRODUCTS = "spent_oil_products"
    TURBINE_OIL = "turbine_oil"
    AVIATION_OIL = "aviation_oil"
    LIQUID_HYDROCARBONS_MIXTURE = "liquid_hydrocarbons_mixture"
    CORROSION_INHIBITOR = "corrosion_inhibitor"


class ResearchMethod(BaseModel):
    __tablename__ = "research_methods"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(
        String(255),
        nullable=False,
        index=True,
        comment="Наименование метода исследования",
    )
    sample_type = Column(
        JSON, nullable=False, default=list, comment="Типы исследуемых проб"
    )
    formula = Column(String(255), nullable=False, comment="Формула для расчета")
    measurement_error = Column(
        JSON, nullable=False, default=dict, comment="Погрешность измерения"
    )
    unit = Column(String(20), nullable=False, comment="Единица измерения результата")
    measurement_method = Column(String(255), nullable=False, comment="Метод измерения")
    nd_code = Column(String(255), nullable=False, comment="Шифр НД")
    nd_name = Column(String(255), nullable=False, comment="Наименование НД")
    input_data = Column(
        JSON, nullable=False, default=dict, comment="Структура входных данных"
    )
    intermediate_data = Column(
        JSON, nullable=False, default=dict, comment="Структура промежуточных данных"
    )
    convergence_conditions = Column(
        JSON,
        nullable=False,
        default=lambda: {
            "formulas": [{"formula": "", "convergence_value": "satisfactory"}]
        },
        comment="Условия повторяемости",
    )
    rounding_type = Column(
        String(20), nullable=False, index=True, comment="Тип округления"
    )
    rounding_decimal = Column(
        Integer, nullable=False, comment="Количество знаков округления"
    )
    is_group_member = Column(
        Boolean, default=False, nullable=False, comment="Является частью группы"
    )
    equipment_data_default = Column(
        JSON, nullable=True, default=list, comment="Приборы по умолчанию"
    )
    sort_order = Column(
        Integer, nullable=True, index=True, comment="Порядок сортировки"
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

    laboratory = relationship("Laboratory", back_populates="research_methods")
    department = relationship("Department", back_populates="research_methods")
    groups = relationship(
        "ResearchMethodGroup",
        secondary="research_method_groups_association",
        back_populates="methods",
    )
    calculations = relationship("Calculation", back_populates="research_method")
    refraction_tables = relationship(
        "MassFractionOilRefractionTable", back_populates="research_method"
    )

    __table_args__ = (
        Index("idx_research_method_name", "name"),
        Index("idx_research_method_rounding_type", "rounding_type"),
        Index("idx_research_method_laboratory", "laboratory_id"),
        Index("idx_research_method_department", "department_id"),
        Index("idx_research_method_sort_order", "sort_order"),
        Index("idx_research_method_created_at", "created_at"),
        Index("idx_research_method_updated_at", "updated_at"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<ResearchMethod(id={self.id}, name='{self.name}', nd_code='{self.nd_code}')>"


class ResearchMethodGroup(BaseModel):
    __tablename__ = "research_method_groups"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(
        String(255),
        nullable=False,
        index=True,
        comment="Наименование группы методов исследования",
    )
    sort_order = Column(
        Integer, nullable=True, index=True, comment="Порядок сортировки группы"
    )

    methods = relationship(
        "ResearchMethod",
        secondary="research_method_groups_association",
        back_populates="groups",
    )

    __table_args__ = (
        Index("idx_research_method_group_name", "name"),
        Index("idx_research_method_group_sort_order", "sort_order"),
        Index("idx_research_method_group_created_at", "created_at"),
        Index("idx_research_method_group_updated_at", "updated_at"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<ResearchMethodGroup(id={self.id}, name='{self.name}')>"


research_method_groups_association = Table(
    "research_method_groups_association",
    Base.metadata,
    Column(
        "research_method_id",
        Integer,
        ForeignKey(f"{get_database_schema()}.research_methods.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "research_method_group_id",
        Integer,
        ForeignKey(
            f"{get_database_schema()}.research_method_groups.id", ondelete="CASCADE"
        ),
        primary_key=True,
    ),
    schema=get_database_schema(),
)
