import re
import subprocess
import sys
from colorama import Fore, Style, init

# Инициализация colorama для Windows
init(autoreset=True)


def colorize_log_line(line: str) -> str:
    """
    Добавляет цвета к логам uvicorn.
    """
    # Цвета для разных типов сообщений
    if "INFO:" in line or "Starting" in line:
        return f"{Fore.CYAN}{line}{Style.RESET_ALL}"

    if "ERROR:" in line or "error" in line.lower():
        return f"{Fore.RED}{line}{Style.RESET_ALL}"

    if "WARNING:" in line or "warning" in line.lower():
        return f"{Fore.YELLOW}{line}{Style.RESET_ALL}"

    # Парсинг access log формата: [time] addr - "method path protocol" status dt_ms
    access_log_pattern = (
        r'\[([^\]]+)\] ([^\s]+) - "(\w+) ([^"]+) ([^"]+)" (\d+) ([\d.]+)ms'
    )
    match = re.match(access_log_pattern, line.strip())

    if match:
        time_str, addr, method, path, protocol, status, dt_ms = match.groups()
        status_code = int(status)

        # Цвета для HTTP методов
        method_colors = {
            "GET": Fore.BLUE,
            "POST": Fore.GREEN,
            "PUT": Fore.YELLOW,
            "DELETE": Fore.RED,
            "PATCH": Fore.MAGENTA,
        }
        method_color = method_colors.get(method, Fore.WHITE)

        # Цвета для статус кодов
        if 200 <= status_code < 300:
            status_color = Fore.GREEN
        elif 300 <= status_code < 400:
            status_color = Fore.CYAN
        elif 400 <= status_code < 500:
            status_color = Fore.YELLOW
        elif status_code >= 500:
            status_color = Fore.RED
        else:
            status_color = Fore.WHITE

        # Форматирование с цветами
        colored_line = (
            f"{Fore.WHITE}[{Fore.CYAN}{time_str}{Fore.WHITE}] "
            f"{Fore.BLUE}{addr}{Fore.WHITE} - "
            f'"{method_color}{method}{Fore.WHITE} '
            f"{Fore.WHITE}{path} "
            f'{Fore.WHITE}{protocol}{Fore.WHITE}" '
            f"{status_color}{status_code}{Fore.WHITE} "
            f"{Fore.MAGENTA}{dt_ms}ms{Style.RESET_ALL}"
        )
        return colored_line

    # Обычные логи без специального форматирования
    return line


def run_uvicorn_with_colors():
    """
    Запускает uvicorn с перехватом и цветным форматированием вывода.
    """
    process = subprocess.Popen(
        [
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
        universal_newlines=True,
        bufsize=1,
    )

    try:
        for line in process.stdout:
            colored_line = colorize_log_line(line.rstrip())
            print(colored_line, flush=True)
    except KeyboardInterrupt:
        print(
            f"{Fore.YELLOW}Получен сигнал завершения, ожидание корректного завершения uvicorn...{Style.RESET_ALL}"
        )
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
