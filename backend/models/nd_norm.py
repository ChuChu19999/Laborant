from sqlalchemy import JSON, Column, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship
from core.config import get_database_schema
from models.base import BaseModel


class NdNorm(BaseModel):
    __tablename__ = "nd_norms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(
        String(255),
        nullable=False,
        index=True,
        comment="Наименование нормы",
    )
    test_object = Column(
        String(255),
        nullable=False,
        index=True,
        comment="Объект испытаний",
    )
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
    method_data = Column(
        JSON,
        nullable=False,
        default=list,
        comment="Тексты нормы по методам исследования: method_id и text",
    )

    laboratory = relationship("Laboratory", back_populates="nd_norms")
    department = relationship("Department", back_populates="nd_norms")

    __table_args__ = (
        Index("idx_nd_norm_name", "name"),
        Index("idx_nd_norm_test_object", "test_object"),
        Index("idx_nd_norm_created_at", "created_at"),
        Index("idx_nd_norm_updated_at", "updated_at"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return (
            f"<NdNorm(id={self.id}, name='{self.name}', "
            f"laboratory_id={self.laboratory_id})>"
        )
