from enum import Enum as PyEnum
from sqlalchemy import Column, Date, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship
from core.config import get_database_schema
from models.base import BaseModel


class EquipmentType(PyEnum):
    MEASURING_INSTRUMENT = "measuring_instrument"
    TEST_EQUIPMENT = "test_equipment"


class Equipment(BaseModel):
    __tablename__ = "equipments"

    id = Column(Integer, primary_key=True, autoincrement=True)

    type = Column(
        String(20), nullable=False, index=True, comment="Тип прибора или оборудования"
    )
    name = Column(
        String(255),
        nullable=False,
        index=True,
        comment="Наименование прибора или оборудования",
    )
    serial_number = Column(
        String(100), nullable=False, comment="Заводской номер прибора или оборудования"
    )
    verification_info = Column(
        String(255), nullable=False, comment="Сведения о результатах поверки"
    )
    verification_date = Column(Date, nullable=False, comment="Дата поверки")
    verification_end_date = Column(
        Date,
        nullable=False,
        index=True,
        comment="Дата окончания срока действия поверки",
    )
    version = Column(String(8), nullable=False, comment="Версия прибора (например, v1)")
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

    laboratory = relationship("Laboratory", back_populates="equipment")
    department = relationship("Department", back_populates="equipment")

    __table_args__ = (
        Index("idx_equipment_type", "type"),
        Index("idx_equipment_name", "name"),
        Index("idx_equipment_verification_end_date", "verification_end_date"),
        Index("idx_equipment_created_at", "created_at"),
        Index("idx_equipment_updated_at", "updated_at"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<Equipment(id={self.id}, name='{self.name}', version='{self.version}', laboratory_id={self.laboratory_id})>"
