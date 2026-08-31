from __future__ import annotations
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import CheckConstraint, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column
from core.config import get_database_schema
from core.database import Base


class PresenceCategory(PyEnum):
    LABORANT = "laborant"
    ENGINEER = "engineer"
    ADMIN = "admin"


class UserPresence(Base):
    """Онлайн-присутствие пользователя (heartbeat, без soft-delete)."""

    __tablename__ = "user_presence"

    hsnils: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        comment="hsnils пользователя",
    )
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        default="",
        comment="ФИО пользователя",
    )
    presence_category: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Категория по приоритету: laborant, engineer, admin",
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        comment="Время последнего heartbeat",
    )
    current_path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Текущий путь клиента",
    )

    __table_args__ = (
        CheckConstraint(
            "presence_category IN ("
            + ", ".join(f"'{member.value.replace(chr(39), chr(39) * 2)}'" for member in PresenceCategory)
            + ")",
            name="ck_user_presence_category",
        ),
        {"schema": get_database_schema()},
    )
