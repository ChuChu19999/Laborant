from __future__ import annotations
from datetime import date
from enum import Enum as PyEnum
from typing import TYPE_CHECKING, Any
from sqlalchemy import JSON, Date, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.config import get_database_schema
from models.base import BaseModel

if TYPE_CHECKING:
    from models.laboratory import Department, Laboratory


class EquipmentType(PyEnum):
    MEASURING_INSTRUMENT = "measuring_instrument"
    TEST_EQUIPMENT = "test_equipment"


class Equipment(BaseModel):
    __tablename__ = "equipments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    type: Mapped[str] = mapped_column(String(20), nullable=False, comment="Тип прибора или оборудования")
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Наименование прибора или оборудования",
    )
    serial_number: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="Заводской номер прибора или оборудования"
    )
    verification_info: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="Сведения о результатах поверки"
    )
    verification_date: Mapped[date] = mapped_column(Date, nullable=False, comment="Дата поверки")
    verification_end_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        comment="Дата окончания срока действия поверки",
    )
    version: Mapped[str] = mapped_column(String(8), nullable=False, comment="Версия прибора (например, v1)")
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
    method_data_default: Mapped[list[Any] | None] = mapped_column(
        JSON, nullable=True, default=list, comment="Методы, которым доступен прибор"
    )

    laboratory: Mapped["Laboratory"] = relationship(back_populates="equipment")
    department: Mapped["Department | None"] = relationship(back_populates="equipment")

    __table_args__ = (
        Index("idx_equipment_type", "type"),
        Index("idx_equipment_name", "name"),
        Index("idx_equipment_verification_end_date", "verification_end_date"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<Equipment(id={self.id}, name='{self.name}', version='{self.version}', laboratory_id={self.laboratory_id})>"
