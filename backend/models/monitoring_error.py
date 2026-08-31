from __future__ import annotations
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import CheckConstraint, DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from core.config import get_database_schema
from models.base import BaseModel


class MonitoringErrorSeverity(PyEnum):
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class MonitoringErrorSource(PyEnum):
    BACKEND = "backend"
    FRONTEND = "frontend"


class MonitoringError(BaseModel):
    __tablename__ = "monitoring_errors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fingerprint: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        comment="SHA-256 fingerprint уникальной ошибки",
    )
    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Уровень: warning, error, critical",
    )
    source: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Источник: backend, frontend",
    )
    message: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Укороченный текст ошибки",
    )
    summary: Mapped[str] = mapped_column(
        String(280),
        nullable=False,
        comment="Краткое описание для списка",
    )
    stack_trace: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Укороченный стек",
    )
    path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Нормализованный путь или URL",
    )
    exception_type: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
        comment="Тип исключения на бэкенде",
    )
    occurrence_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="Число повторов",
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Время закрытия ошибки",
    )
    reporter_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="ФИО при репорте с клиента",
    )
    reporter_hash: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
        comment="hsnils при репорте с клиента",
    )
    user_agent: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="User-Agent браузера",
    )
    app_version: Mapped[str | None] = mapped_column(
        String(40),
        nullable=True,
        comment="Версия приложения при ошибке",
    )
    resolved_by_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="ФИО закрывшего ошибку",
    )
    resolved_by_hash: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
        comment="hsnils закрывшего ошибку",
    )
    resolve_comment: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Комментарий при закрытии",
    )

    __table_args__ = (
        CheckConstraint(
            "severity IN ("
            + ", ".join(f"'{member.value.replace(chr(39), chr(39) * 2)}'" for member in MonitoringErrorSeverity)
            + ")",
            name="ck_monitoring_errors_severity",
        ),
        CheckConstraint(
            "source IN ("
            + ", ".join(f"'{member.value.replace(chr(39), chr(39) * 2)}'" for member in MonitoringErrorSource)
            + ")",
            name="ck_monitoring_errors_source",
        ),
        Index("unique_monitoring_error_fingerprint", "fingerprint", unique=True),
        {"schema": get_database_schema()},
    )
