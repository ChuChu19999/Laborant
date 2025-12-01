import builtins
import logging
import sys
from typing import TYPE_CHECKING
from loguru import logger
from core.config import settings

if TYPE_CHECKING:
    from loguru import Logger


class InterceptHandler(logging.Handler):
    """Перехватчик стандартного logging для перенаправления в Loguru."""

    def emit(self, record):
        # Получаем соответствующий уровень Loguru
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        # Находим вызывающий фрейм
        frame, depth = sys._getframe(6), 6
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(
            level, record.getMessage()
        )


def setup_logger():
    """Настройка глобального логгера Loguru."""
    logger.remove()

    # Настройка формата логов
    log_format = (
        "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
        "<level>{message}</level>"
    )

    # Добавляем обработчик для консоли (docker logs)
    logger.add(
        sys.stderr,
        format=log_format,
        level="DEBUG" if settings.DEBUG else "INFO",
        colorize=True,
        backtrace=True,
        diagnose=True,
    )

    # Перехватываем стандартный logging и перенаправляем в Loguru
    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)

    # Отключаем логирование для некоторых библиотек
    for logger_name in ["uvicorn.access", "uvicorn.error"]:
        logging_logger = logging.getLogger(logger_name)
        logging_logger.handlers = [InterceptHandler()]

    # Добавляем logger в builtins для глобального доступа
    builtins.logger = logger  # type: ignore[assignment]

    return logger


setup_logger()
