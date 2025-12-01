from sqlalchemy import JSON, Boolean, Column, Date, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship
from core.config import get_database_schema
from models.base import BaseModel


class Protocol(BaseModel):
    __tablename__ = "protocols"

    id = Column(Integer, primary_key=True, autoincrement=True)

    test_protocol_number = Column(
        String(100), nullable=True, index=True, comment="Номер протокола испытаний"
    )
    test_protocol_date = Column(Date, nullable=True, comment="Дата протокола испытаний")
    is_accredited = Column(
        Boolean, default=False, nullable=False, comment="Признак аккредитации протокола"
    )
    sampling_act_number = Column(
        String(50), nullable=False, comment="Номер акта отбора"
    )
    issued = Column(
        String(150), nullable=True, comment="hsnils лица, оформившего протокол"
    )
    approved = Column(
        String(150), nullable=True, comment="hsnils лица, утвердившего протокол"
    )
    issued_position = Column(
        String(100), nullable=True, comment="Должность оформившего"
    )
    approved_position = Column(
        String(100), nullable=True, comment="Должность утвердившего"
    )
    protocol_template_id = Column(
        Integer,
        ForeignKey(
            f"{get_database_schema()}.protocol_templates.id", ondelete="SET NULL"
        ),
        nullable=True,
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
    samples = Column(
        JSON,
        nullable=True,
        default=list,
        comment="Массив ID проб, привязанных к протоколу",
    )

    laboratory = relationship("Laboratory", back_populates="protocols")
    department = relationship("Department", back_populates="protocols")
    protocol_template = relationship("ProtocolTemplate", back_populates="protocols")

    __table_args__ = (
        Index("idx_protocol_test_protocol_number", "test_protocol_number"),
        Index("idx_protocol_laboratory", "laboratory_id"),
        Index("idx_protocol_department", "department_id"),
        Index("idx_protocol_created_at", "created_at"),
        Index("idx_protocol_updated_at", "updated_at"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<Protocol(id={self.id}, test_protocol_number='{self.test_protocol_number}', laboratory_id={self.laboratory_id})>"


class ProtocolTemplate(BaseModel):
    __tablename__ = "protocol_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String(100), nullable=False, index=True, comment="Название шаблона")
    version = Column(String(8), nullable=False, comment="Версия шаблона (например, v1)")
    file = Column(String, nullable=False, comment="xlsx файл (base64 или путь)")
    file_name = Column(String(100), nullable=False, comment="Оригинальное имя файла")
    accreditation_header_row = Column(
        Integer, nullable=True, comment="Строка шапки аккредитации"
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

    laboratory = relationship("Laboratory", back_populates="protocol_templates")
    department = relationship("Department", back_populates="protocol_templates")
    protocols = relationship("Protocol", back_populates="protocol_template")

    __table_args__ = (
        Index("idx_protocol_template_name", "name"),
        Index("idx_protocol_template_laboratory", "laboratory_id"),
        Index("idx_protocol_template_department", "department_id"),
        Index("idx_protocol_template_created_at", "created_at"),
        Index("idx_protocol_template_updated_at", "updated_at"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<ProtocolTemplate(id={self.id}, name='{self.name}', version='{self.version}')>"
