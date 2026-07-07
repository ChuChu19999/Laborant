from __future__ import annotations
from datetime import date
from typing import TYPE_CHECKING, Any, Optional
from sqlalchemy import JSON, Boolean, Date, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.config import get_database_schema
from models.base import BaseModel

if TYPE_CHECKING:
    from models.laboratory import Department, Laboratory


class Protocol(BaseModel):
    __tablename__ = "protocols"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    test_protocol_number: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="Номер протокола испытаний"
    )
    test_protocol_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="Дата протокола испытаний"
    )
    is_accredited: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="Признак аккредитации протокола"
    )
    sampling_act_number: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="Номер акта отбора"
    )
    issued: Mapped[Optional[str]] = mapped_column(
        String(150), nullable=True, comment="hsnils лица, оформившего протокол"
    )
    approved: Mapped[Optional[str]] = mapped_column(
        String(150), nullable=True, comment="hsnils лица, утвердившего протокол"
    )
    issued_position: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="Должность оформившего"
    )
    approved_position: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="Должность утвердившего"
    )
    protocol_template_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey(
            f"{get_database_schema()}.protocol_templates.id", ondelete="SET NULL"
        ),
        nullable=True,
    )
    laboratory_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.laboratories.id", ondelete="CASCADE"),
        nullable=False,
    )
    department_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.departments.id", ondelete="CASCADE"),
        nullable=True,
    )
    samples: Mapped[Optional[list[Any]]] = mapped_column(
        JSON,
        nullable=True,
        default=list,
        comment="Массив ID проб, привязанных к протоколу",
    )

    laboratory: Mapped["Laboratory"] = relationship(back_populates="protocols")
    department: Mapped[Optional["Department"]] = relationship(
        back_populates="protocols"
    )
    protocol_template: Mapped[Optional["ProtocolTemplate"]] = relationship(
        back_populates="protocols"
    )

    __table_args__ = (
        Index("idx_protocol_test_protocol_number", "test_protocol_number"),
        Index("idx_protocol_laboratory", "laboratory_id"),
        Index("idx_protocol_department", "department_id"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<Protocol(id={self.id}, test_protocol_number='{self.test_protocol_number}', laboratory_id={self.laboratory_id})>"


class ProtocolTemplate(BaseModel):
    __tablename__ = "protocol_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="Название шаблона"
    )
    version: Mapped[str] = mapped_column(
        String(8), nullable=False, comment="Версия шаблона (например, v1)"
    )
    file: Mapped[str] = mapped_column(String, nullable=False, comment="xlsx файл")
    file_name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="Имя файла"
    )
    accreditation_header_row: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="Строка шапки аккредитации"
    )
    laboratory_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.laboratories.id", ondelete="CASCADE"),
        nullable=False,
    )
    department_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey(f"{get_database_schema()}.departments.id", ondelete="CASCADE"),
        nullable=True,
    )

    laboratory: Mapped["Laboratory"] = relationship(back_populates="protocol_templates")
    department: Mapped[Optional["Department"]] = relationship(
        back_populates="protocol_templates"
    )
    protocols: Mapped[list["Protocol"]] = relationship(
        back_populates="protocol_template"
    )

    __table_args__ = (
        Index("idx_protocol_template_name", "name"),
        Index("idx_protocol_template_laboratory", "laboratory_id"),
        Index("idx_protocol_template_department", "department_id"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<ProtocolTemplate(id={self.id}, name='{self.name}', version='{self.version}')>"
