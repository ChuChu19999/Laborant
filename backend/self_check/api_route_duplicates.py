from __future__ import annotations
import ast
from self_check import api_routes_ast
from self_check._common import ROOT, iter_py_files

_DUPLICATE_MESSAGE = "дублирующийся роут (method + path) в одном файле — FastAPI молча оставит последний"


def _find_duplicate_routes(
    routes: list[api_routes_ast.RouteDecl],
) -> list[tuple[api_routes_ast.RouteDecl, api_routes_ast.RouteDecl]]:
    """Найти пары роутов с одинаковыми method и path."""
    seen: dict[tuple[str, str], api_routes_ast.RouteDecl] = {}
    violations: list[tuple[api_routes_ast.RouteDecl, api_routes_ast.RouteDecl]] = []
    for route in routes:
        key = (route.method, route.path)
        previous = seen.get(key)
        if previous is not None:
            violations.append((previous, route))
            continue
        seen[key] = route
    return violations


def collect_errors() -> list[str]:
    """Запретить дубли method+path в одном api-модуле."""
    errors: list[str] = []
    for path in iter_py_files("api"):
        rel = path.relative_to(ROOT).as_posix()
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except SyntaxError as exc:
            errors.append(f"[api] {rel}: syntax error: {exc}")
            continue

        for earlier_route, later_route in _find_duplicate_routes(api_routes_ast.scan_file_routes(tree)):
            errors.append(
                f"[api] {rel}:{later_route.lineno}: {_DUPLICATE_MESSAGE} "
                f"({earlier_route.method.upper()} {earlier_route.path!r} в {earlier_route.func_name}, "
                f"повтор в {later_route.func_name})"
            )
    return errors
