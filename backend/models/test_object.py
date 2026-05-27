from sqlalchemy import JSON, Column, Index, Integer, String, text
from core.config import get_database_schema
from models.base import BaseModel


class TestObject(BaseModel):
    __tablename__ = "test_objects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(
        String(255),
        nullable=False,
        index=True,
        comment="Наименование объекта испытаний",
    )
    tag = Column(
        String(50),
        nullable=False,
        index=True,
        comment="Тег для связи с методами исследования",
    )
    visibility_scope = Column(
        JSON,
        nullable=False,
        default=lambda: {"laboratory_ids": [], "department_ids": []},
        comment="Область видимости: laboratory_ids, department_ids",
    )

    __table_args__ = (
        Index(
            "unique_test_object_name",
            "name",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("idx_test_object_tag", "tag"),
        Index("idx_test_object_created_at", "created_at"),
        Index("idx_test_object_updated_at", "updated_at"),
        {"schema": get_database_schema()},
    )

    def __repr__(self):
        return f"<TestObject(id={self.id}, name='{self.name}', tag='{self.tag}')>"
