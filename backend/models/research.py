from __future__ import annotations
from enum import Enum as PyEnum
from typing import TYPE_CHECKING, Any
from sqlalchemy import JSON, Boolean, Column, ForeignKey, Index, Integer, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.config import get_database_schema
from core.database import Base
from models.base import BaseModel

if TYPE_CHECKING:
    from models.calculation import Calculation
    from models.laboratory import Department, Laboratory
    from models.mass_fraction import MassFractionOilRefractionTable


class RoundingType(PyEnum):
    DECIMAL = "decimal"
    SIGNIFICANT = "significant"


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
        ForeignKey(f"{get_database_schema()}.research_method_groups.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    schema=get_database_schema(),
)


class ResearchMethod(BaseModel):
    __tablename__ = "research_methods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Наименование метода исследования",
    )
    sample_type: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list, comment="Типы исследуемых проб")
    formula: Mapped[str] = mapped_column(String(255), nullable=False, comment="Формула для расчета")
    measurement_error: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=dict, comment="Погрешность измерения"
    )
    unit: Mapped[str] = mapped_column(String(20), nullable=False, comment="Единица измерения результата")
    measurement_method: Mapped[str] = mapped_column(String(255), nullable=False, comment="Метод измерения")
    nd_code: Mapped[str] = mapped_column(String(255), nullable=False, comment="Шифр НД")
    nd_name: Mapped[str] = mapped_column(String(255), nullable=False, comment="Наименование НД")
    input_data: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=dict, comment="Структура входных данных"
    )
    intermediate_data: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=dict, comment="Структура промежуточных данных"
    )
    convergence_conditions: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        default=lambda: {"formulas": [{"formula": "", "convergence_value": "satisfactory"}]},
        comment="Условия повторяемости",
    )
    rounding_type: Mapped[str] = mapped_column(String(20), nullable=False, comment="Тип округления")
    rounding_decimal: Mapped[int] = mapped_column(Integer, nullable=False, comment="Количество знаков округления")
    is_group_member: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="Является частью группы"
    )
    equipment_data_default: Mapped[list[Any] | None] = mapped_column(
        JSON, nullable=True, default=list, comment="Приборы по умолчанию"
    )
    sort_order: Mapped[int | None] = mapped_column(Integer, nullable=True, comment="Порядок сортировки")
    laboratory_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.laboratories.id", ondelete="CASCADE"),
        nullable=True,
    )
    department_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.departments.id", ondelete="CASCADE"),
        nullable=True,
    )

    laboratory: Mapped["Laboratory | None"] = relationship(back_populates="research_methods")
    department: Mapped["Department | None"] = relationship(back_populates="research_methods")
    groups: Mapped[list["ResearchMethodGroup"]] = relationship(
        secondary=research_method_groups_association,
        back_populates="methods",
    )
    calculations: Mapped[list["Calculation"]] = relationship(back_populates="research_method")
    refraction_tables: Mapped[list["MassFractionOilRefractionTable"]] = relationship(back_populates="research_method")

    __table_args__ = (
        Index("idx_research_method_name", "name"),
        Index("idx_research_method_rounding_type", "rounding_type"),
        Index("idx_research_method_laboratory", "laboratory_id"),
        Index("idx_research_method_department", "department_id"),
        Index("idx_research_method_sort_order", "sort_order"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<ResearchMethod(id={self.id}, name='{self.name}', nd_code='{self.nd_code}')>"


class ResearchMethodGroup(BaseModel):
    __tablename__ = "research_method_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Наименование группы методов исследования",
    )
    sort_order: Mapped[int | None] = mapped_column(Integer, nullable=True, comment="Порядок сортировки группы")

    methods: Mapped[list["ResearchMethod"]] = relationship(
        secondary=research_method_groups_association,
        back_populates="groups",
    )

    __table_args__ = (
        Index("idx_research_method_group_name", "name"),
        Index("idx_research_method_group_sort_order", "sort_order"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<ResearchMethodGroup(id={self.id}, name='{self.name}')>"
