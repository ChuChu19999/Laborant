import pendulum
from sqlalchemy import Column, DateTime, String, event
from sqlalchemy.sql import func
from core.config import get_database_schema
from core.database import Base
from utils.current_user import get_current_user


class BaseModel(Base):
    __abstract__ = True
    __table_args__ = {"schema": get_database_schema()}

    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        index=True,
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_by = Column(String(255), nullable=True, index=True)
    created_by_hash = Column(String(32), nullable=True, index=True)
    updated_by = Column(String(255), nullable=True, index=True)
    updated_by_hash = Column(String(32), nullable=True, index=True)
    deleted_by = Column(String(255), nullable=True, index=True)
    deleted_by_hash = Column(String(32), nullable=True, index=True)

    def soft_delete(self):
        """Мягкое удаление записи с установкой deleted_by, deleted_by_hash и deleted_at."""
        self.deleted_at = pendulum.now("UTC")
        current_user = get_current_user()
        if current_user:
            full_name, hsnils = current_user
            self.deleted_by = full_name
            self.deleted_by_hash = hsnils


@event.listens_for(BaseModel, "before_insert", propagate=True)
def receive_before_insert(mapper, connection, target):
    """Автоматически заполняет created_by и created_by_hash при создании записи."""
    current_user = get_current_user()
    if current_user and hasattr(target, "created_by"):
        full_name, hsnils = current_user
        target.created_by = full_name
        if hasattr(target, "created_by_hash"):
            target.created_by_hash = hsnils


@event.listens_for(BaseModel, "before_update", propagate=True)
def receive_before_update(mapper, connection, target):
    """Автоматически заполняет updated_by и updated_by_hash при обновлении записи."""
    current_user = get_current_user()
    if current_user and hasattr(target, "updated_by"):
        full_name, hsnils = current_user
        # Обновляем updated_by только если запись не удаляется
        if hasattr(target, "deleted_at") and target.deleted_at is None:
            target.updated_by = full_name
            if hasattr(target, "updated_by_hash"):
                target.updated_by_hash = hsnils
        elif not hasattr(target, "deleted_at"):
            target.updated_by = full_name
            if hasattr(target, "updated_by_hash"):
                target.updated_by_hash = hsnils
