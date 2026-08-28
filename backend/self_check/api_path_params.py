from __future__ import annotations
import ast
import re
from self_check import api_routes_ast
from self_check._common import ROOT, iter_py_files

_ID_PARAM_WITHOUT_CONVERTER = re.compile(r"\{([a-z][a-z0-9_]*_id)\}")

_MESSAGE = (
    "path-параметр {name} без конвертера типа — для id используйте {{{name}:int}} "
    "(строковые ключи вне *_id — в allowlist)"
)

# Строковые path-ключи, для которых :int не требуется (не оканчиваются на _id).
_STRING_PARAM_ALLOWLIST = frozenset({"hsnils"})


def _violations_in_path(path: str) -> list[str]:
    """Вернуть имена *_id-параметров без :int в пути."""
    names: list[str] = []
    for match in _ID_PARAM_WITHOUT_CONVERTER.finditer(path):
        name = match.group(1)
        if name in _STRING_PARAM_ALLOWLIST:
            continue
        names.append(name)
    return names


def collect_errors() -> list[str]:
    """Требовать :int у path-параметров *_id в api."""
    errors: list[str] = []
    for file_path in iter_py_files("api"):
        rel = file_path.relative_to(ROOT).as_posix()
        try:
            tree = ast.parse(file_path.read_text(encoding="utf-8"), filename=str(file_path))
        except SyntaxError as exc:
            errors.append(f"[api] {rel}: syntax error: {exc}")
            continue

        for route in api_routes_ast.scan_file_routes(tree):
            for param_name in _violations_in_path(route.path):
                errors.append(
                    f"[api] {rel}:{route.lineno}: {_MESSAGE.format(name=param_name)} "
                    f"({route.method.upper()} {route.path!r})"
                )
    return errors
