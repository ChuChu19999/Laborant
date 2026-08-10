"""Команда для проверок качества кода бэкенда.

Примеры:
  python check.py
  python check.py --fix
  python check.py --skip-types
"""

from __future__ import annotations
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent


def run(title: str, command: list[str]) -> int:
    """Запускает команду и печатает заголовок шага."""
    print(f"\n=== {title} ===")
    print(" ".join(command))
    # UTF-8 нужен import-linter/rich на Windows (cp1251 ломается на спецсимволах).
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}
    completed = subprocess.run(command, cwd=ROOT, env=env)
    return completed.returncode


def lint_imports_command() -> list[str]:
    """Возвращает команду import-linter из того же окружения, что и интерпретатор."""
    scripts_dir = Path(sys.executable).resolve().parent
    candidate = scripts_dir / ("lint-imports.exe" if sys.platform == "win32" else "lint-imports")
    if candidate.exists():
        return [str(candidate)]
    found = shutil.which("lint-imports")
    if found:
        return [found]
    raise SystemExit("Не найден lint-imports. Установите зависимости: pip install -r requirements.txt")


def main() -> int:
    """Запускает Ruff, basedpyright и import-linter."""
    parser = argparse.ArgumentParser(description="Проверки бэкенда одной командой.")
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Автоисправление Ruff (format + check --fix) перед проверками.",
    )
    parser.add_argument(
        "--skip-types",
        action="store_true",
        help="Пропустить basedpyright (быстрее, только стиль и слои).",
    )
    parser.add_argument(
        "--skip-layers",
        action="store_true",
        help="Пропустить import-linter.",
    )
    args = parser.parse_args()

    steps: list[tuple[str, list[str]]] = []

    if args.fix:
        steps.append(("Ruff format", [sys.executable, "-m", "ruff", "format", "."]))
        steps.append(
            (
                "Ruff check --fix",
                [sys.executable, "-m", "ruff", "check", "--fix", "."],
            )
        )
    else:
        steps.append(("Ruff format --check", [sys.executable, "-m", "ruff", "format", "--check", "."]))
        steps.append(("Ruff check", [sys.executable, "-m", "ruff", "check", "."]))

    if not args.skip_types:
        steps.append(("basedpyright", [sys.executable, "-m", "basedpyright"]))

    if not args.skip_layers:
        steps.append(("import-linter", lint_imports_command()))

    failed: list[str] = []
    for title, command in steps:
        code = run(title, command)
        if code != 0:
            failed.append(title)

    print()
    if failed:
        print("Провалено:")
        for title in failed:
            print(f"  - {title}")
        return 1

    print("Все проверки прошли.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
