from __future__ import annotations
import asyncio
from logging.config import fileConfig
from pathlib import Path
import sys
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.config import get_database_schema, settings
from core.database import Base
import models as _models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", str(settings.DATABASE_URL))

target_metadata = Base.metadata
SCHEMA_NAME = get_database_schema()


def include_object(obj, _name, type_, _reflected, _compare_to) -> bool:
    """Сравнивать/мигрировать только объекты целевой схемы приложения."""
    if type_ == "table":
        return getattr(obj, "schema", None) == SCHEMA_NAME
    if type_ in {"index", "unique_constraint", "foreign_key_constraint", "check_constraint"}:
        table = getattr(obj, "table", None)
        if table is not None:
            return getattr(table, "schema", None) == SCHEMA_NAME
    return True


def do_run_migrations(connection: Connection) -> None:
    """Применить миграции в рамках переданного соединения."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table_schema=SCHEMA_NAME,
        include_schemas=True,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Онлайн-режим: применить миграции через async-движок."""
    connectable = create_async_engine(
        str(settings.DATABASE_URL),
        poolclass=pool.NullPool,
        connect_args={
            "server_settings": {
                "search_path": SCHEMA_NAME,
            }
        },
        echo=False,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_offline() -> None:
    """Офлайн-режим: сгенерировать SQL миграций без подключения к БД."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table_schema=SCHEMA_NAME,
        include_schemas=True,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
