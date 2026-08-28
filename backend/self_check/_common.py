from __future__ import annotations
from collections.abc import Iterable
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent

PatternSpec = tuple[re.Pattern[str], str]


def iter_py_files(layer: str) -> list[Path]:
    """Вернуть .py файлы слоя (без __pycache__)."""
    base = ROOT / layer
    if not base.is_dir():
        return []
    return [path for path in base.rglob("*.py") if "__pycache__" not in path.parts]


def line_no(text: str, index: int) -> int:
    """Вернуть 1-based номер строки по смещению в тексте."""
    return text.count("\n", 0, index) + 1


def is_match_commented(text: str, match_start: int) -> bool:
    """Вернуть True, если совпадение на закомментированной строке."""
    line_start = text.rfind("\n", 0, match_start) + 1
    return text[line_start:match_start].lstrip().startswith("#")


def scan_layer_patterns(layer: str, patterns: Iterable[PatternSpec], *, tag: str) -> list[str]:
    """Прогнать regex-паттерны по файлам одного слоя."""
    errors: list[str] = []
    for path in iter_py_files(layer):
        text = path.read_text(encoding="utf-8")
        rel = path.relative_to(ROOT).as_posix()
        for pattern, message in patterns:
            for match in pattern.finditer(text):
                if is_match_commented(text, match.start()):
                    continue
                errors.append(f"[{tag}] {rel}:{line_no(text, match.start())}: {message}")
    return errors


def scan_layer_file_patterns(
    layer: str,
    patterns: Iterable[PatternSpec],
    *,
    tag: str,
    allow_rel_paths: frozenset[str] | None = None,
) -> list[str]:
    """Как scan_layer_patterns, но пропускает allow_rel_paths (posix relative)."""
    allowed = allow_rel_paths or frozenset()
    errors: list[str] = []
    for path in iter_py_files(layer):
        rel = path.relative_to(ROOT).as_posix()
        if rel in allowed:
            continue
        text = path.read_text(encoding="utf-8")
        for pattern, message in patterns:
            for match in pattern.finditer(text):
                if is_match_commented(text, match.start()):
                    continue
                errors.append(f"[{tag}] {rel}:{line_no(text, match.start())}: {message}")
    return errors
