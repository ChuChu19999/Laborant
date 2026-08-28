from __future__ import annotations
import logging
import sys
from loguru import logger
from core.config import settings


def _configure_stdio_utf8() -> None:
    """Windows-консоль по умолчанию cp1251/cp866 — принудительно UTF-8 для кириллицы в логах."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="replace")


class InterceptHandler(logging.Handler):
    """Перехватить стандартный logging и перенаправить сообщения в Loguru."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            level: str | int = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        frame, depth = logging.currentframe(), 2
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def setup_logger() -> None:
    """Настроить глобальный логгер Loguru."""
    _configure_stdio_utf8()
    logger.remove()

    log_format = (
        "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
        "<level>{message}</level>"
    )
    debug = settings.DEBUG

    logger.add(
        sys.stderr,
        format=log_format,
        level="DEBUG" if debug else "INFO",
        colorize=True,
        backtrace=debug,
        diagnose=debug,
    )

    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)

    for logger_name in ["uvicorn.access", "uvicorn.error"]:
        logging_logger = logging.getLogger(logger_name)
        logging_logger.handlers = [InterceptHandler()]


setup_logger()
