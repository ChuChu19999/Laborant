import asyncio
import logging
import os
import sys
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, base_dir)

from core.config import get_database_schema, settings
from core.database import Base
from models import (  # noqa: F401
    BaseModel,
    Branch,
    Calculation,
    Department,
    Equipment,
    EquipmentType,
    Laboratory,
    MassFractionOilRefractionTable,
    NdNorm,
    Protocol,
    ProtocolTemplate,
    ReportTemplate,
    ResearchMethod,
    ResearchMethodGroup,
    Role,
    Sample,
    SamplingLocation,
    SelectionConditions,
    TestObject,
)
from models.research import research_method_groups_association  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata

logging.getLogger("alembic.ddl.postgresql").setLevel(logging.WARNING)


def include_object(object, name, type_, reflected, compare_to):
    """
    Ограничиваем автогенерацию Alembic только нашей схемой.
    Это предотвращает попытки удалить/создать объекты из чужих схем.
    """
    schema_name = get_database_schema()

    # Ранний выход для отраженных объектов из чужих схем
    if reflected:
        obj_schema = getattr(object, "schema", None)
        if obj_schema != schema_name:
            return False

    try:
        if type_ == "table":
            object_schema = getattr(object, "schema", None)
            return object_schema == schema_name
        if type_ == "index":
            table = getattr(object, "table", None)
            if table is not None:
                table_schema = getattr(table, "schema", None)
                return table_schema == schema_name
            return False
        if type_ == "column":
            table = getattr(object, "table", None)
            if table is not None:
                table_schema = getattr(table, "schema", None)
                return table_schema == schema_name
            return False
        if type_ == "sequence":
            object_schema = getattr(object, "schema", None)
            if object_schema is None or object_schema != schema_name:
                return False
            return True
        parent_table = getattr(object, "table", None) or getattr(object, "parent", None)
        if parent_table is not None:
            parent_schema = getattr(parent_table, "schema", None)
            return parent_schema == schema_name
    except Exception:
        return False
    return False


def do_run_migrations(connection):
    schema_name = get_database_schema()

    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table_schema=schema_name,
        include_schemas=True,
        include_object=include_object,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    schema_name = get_database_schema()
    connectable = create_async_engine(
        settings.DATABASE_URL,
        poolclass=pool.NullPool,
        connect_args={
            "server_settings": {
                "search_path": schema_name,
            }
        },
        echo=False,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    schema_name = get_database_schema()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table_schema=schema_name,
        include_schemas=True,
        include_object=include_object,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
