"""Команда для проверок качества кода бэкенда.

Команды:
  python check.py
  python check.py --fix

Шаги: Ruff → basedpyright → import-linter → self_check по слоям
(api, core, models, repositories, schemas, services, utils).
"""

from __future__ import annotations
import argparse
from dataclasses import dataclass
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent


@dataclass
class StepResult:
    title: str
    code: int
    output: str

    @property
    def ok(self) -> bool:
        return self.code == 0


def run(title: str, command: list[str]) -> StepResult:
    """Запустить команду, напечатать краткий статус, сохранить полный вывод."""
    print(f"\n=== {title} ===")
    print(" ".join(command))
    # UTF-8 нужен import-linter/rich на Windows (cp1251 ломается на спецсимволах).
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}
    completed = subprocess.run(
        command,
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    output = "".join(part for part in (completed.stdout, completed.stderr) if part)
    print("OK" if completed.returncode == 0 else f"FAIL (код {completed.returncode})")
    return StepResult(title=title, code=completed.returncode, output=output)


def lint_imports_command() -> list[str]:
    """Вернуть команду import-linter из того же окружения, что и интерпретатор."""
    scripts_dir = Path(sys.executable).resolve().parent
    candidate = scripts_dir / ("lint-imports.exe" if sys.platform == "win32" else "lint-imports")
    if candidate.exists():
        return [str(candidate)]
    found = shutil.which("lint-imports")
    if found:
        return [found]
    raise SystemExit("Не найден lint-imports. Установите зависимости: pip install -r requirements.txt")


def print_summary(results: list[StepResult]) -> None:
    """Вывести сводку статусов; полный вывод только у проваленных шагов."""
    print("\n" + "=" * 60)
    print("ИТОГ")
    print("=" * 60)

    failed = [r for r in results if not r.ok]
    for result in results:
        mark = "OK" if result.ok else "FAIL"
        print(f"  [{mark}] {result.title}")

    if failed:
        print("\n" + "=" * 60)
        print("ДЕТАЛИ (ошибки)")
        print("=" * 60)
        for result in failed:
            print(f"\n--- [FAIL] {result.title} ---")
            print(result.output.rstrip() or "(пустой вывод)")
        print()
        print(f"Провалено шагов: {len(failed)}")
        for result in failed:
            print(f"  - {result.title}")
    else:
        print()
        print("Все проверки прошли.")


def run_self_check() -> StepResult:
    """Прогнать self_check: модуль на слой + runtime schemas."""
    title = "self-check (api/core/models/repositories/schemas/services/utils)"
    print(f"\n=== {title} ===")
    print("self_check.collect_self_check_errors_by_layer()")
    try:
        from self_check import collect_self_check_errors_by_layer

        by_layer = collect_self_check_errors_by_layer()
        errors = [item for items in by_layer.values() for item in items]
        if errors:
            parts: list[str] = []
            for layer_name, items in by_layer.items():
                if not items:
                    print(f"  [{layer_name}] OK")
                    continue
                print(f"  [{layer_name}] FAIL ({len(items)})")
                parts.append(f"{layer_name}: {len(items)}")
                parts.extend(f"  - {item}" for item in items)
            print("FAIL (код 1)")
            return StepResult(title=title, code=1, output="Self-check failed:\n" + "\n".join(parts))
        for layer_name in by_layer:
            print(f"  [{layer_name}] OK")
    except Exception as exc:  # noqa: BLE001 — шаг check.py: показать любую ошибку самопроверки
        print("FAIL (код 1)")
        return StepResult(title=title, code=1, output=str(exc))
    print("OK")
    return StepResult(title=title, code=0, output="")


def main() -> int:
    """Запустить Ruff, basedpyright, import-linter и self-check по слоям."""
    parser = argparse.ArgumentParser(description="Проверки бэкенда одной командой.")
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Автоисправление Ruff (format + check --fix) перед проверками.",
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

    steps.append(("basedpyright", [sys.executable, "-m", "basedpyright"]))
    steps.append(("import-linter", lint_imports_command()))

    results = [run(title, command) for title, command in steps]
    results.append(run_self_check())
    print_summary(results)
    return 1 if any(not r.ok for r in results) else 0


if __name__ == "__main__":
    raise SystemExit(main())
