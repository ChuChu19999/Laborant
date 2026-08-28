from __future__ import annotations
import re
import subprocess
import sys
from colorama import Fore, Style, init

# Инициализация colorama для Windows
init(autoreset=True)


def _configure_stdio_utf8() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="replace")


_configure_stdio_utf8()


def colorize_log_line(line: str) -> str:
    """Добавить цвета к логам uvicorn / Loguru по уровню сообщения."""
    if "INFO:" in line or "Starting" in line:
        return f"{Fore.CYAN}{line}{Style.RESET_ALL}"

    if "ERROR:" in line or re.search(r"\berror\b", line, re.IGNORECASE):
        return f"{Fore.RED}{line}{Style.RESET_ALL}"

    if "WARNING:" in line or re.search(r"\bwarning\b", line, re.IGNORECASE):
        return f"{Fore.YELLOW}{line}{Style.RESET_ALL}"

    return line


def run_uvicorn_with_colors() -> None:
    """Запустить uvicorn с перехватом и цветным форматированием вывода."""
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "main:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8000",
            "--reload",
            "--log-level",
            "info",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )

    try:
        if process.stdout is not None:
            for line in process.stdout:
                colored_line = colorize_log_line(line.rstrip())
                print(colored_line, flush=True)
    except KeyboardInterrupt:
        print(f"{Fore.YELLOW}Получен сигнал завершения, ожидание корректного завершения uvicorn...{Style.RESET_ALL}")
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            print(f"{Fore.RED}Принудительное завершение процесса...{Style.RESET_ALL}")
            process.kill()
            process.wait()
        sys.exit(0)
    finally:
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        if process.returncode != 0:
            sys.exit(process.returncode)


if __name__ == "__main__":
    run_uvicorn_with_colors()
