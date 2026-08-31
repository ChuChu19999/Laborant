from collections.abc import AsyncGenerator, Awaitable, Callable
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import AsyncAdaptedQueuePool
from core.config import get_database_schema, settings

engine = create_async_engine(
    str(settings.DATABASE_URL),
    poolclass=AsyncAdaptedQueuePool,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
    connect_args={"server_settings": {"search_path": get_database_schema()}},
)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """Базовый класс декларативных ORM-моделей."""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Выдать сессию БД с автокоммитом или откатом транзакции."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def run_isolated_transaction(
    operation: Callable[[AsyncSession], Awaitable[None]],
) -> None:
    """Выполнить операцию в отдельной транзакции вне HTTP-запроса."""
    async with AsyncSessionLocal() as session:
        try:
            await operation(session)
            await session.commit()
        except Exception:
            await session.rollback()
            raise
