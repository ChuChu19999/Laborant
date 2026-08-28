from __future__ import annotations
import ast
from self_check import api_routes_ast
from self_check._common import ROOT, iter_py_files

_ROUTE_ORDER_MESSAGE = (
    "статический сегмент пути объявлен после параметрического на том же префиксе — "
    "FastAPI вернёт 422; литеральные пути (export, available, …) регистрировать до {{param}} "
    "(см. backend.api.router_order)"
)


def _earlier_shadows_later(earlier_path: str, later_path: str) -> bool:
    """Проверить, перехватывает ли ранний path-параметр запрос к литеральному сегменту."""
    earlier_segments = api_routes_ast.path_segments(earlier_path)
    later_segments = api_routes_ast.path_segments(later_path)
    if len(earlier_segments) != len(later_segments):
        return False

    has_param_over_literal = False
    for earlier_segment, later_segment in zip(earlier_segments, later_segments, strict=True):
        if api_routes_ast.is_path_param(earlier_segment):
            if not api_routes_ast.is_path_param(later_segment):
                has_param_over_literal = True
            continue
        if earlier_segment != later_segment:
            return False
    return has_param_over_literal


def _find_shadow_violations(
    routes: list[api_routes_ast.RouteDecl],
) -> list[tuple[api_routes_ast.RouteDecl, api_routes_ast.RouteDecl]]:
    violations: list[tuple[api_routes_ast.RouteDecl, api_routes_ast.RouteDecl]] = []
    for method in api_routes_ast.ROUTER_HTTP_METHODS:
        method_routes = [route for route in routes if route.method == method]
        for earlier_index, earlier_route in enumerate(method_routes):
            for later_route in method_routes[earlier_index + 1 :]:
                if _earlier_shadows_later(earlier_route.path, later_route.path):
                    violations.append((earlier_route, later_route))
    return violations


def collect_errors() -> list[str]:
    """Запретить порядок роутов, при котором path-параметр перехватывает литеральный сегмент."""
    errors: list[str] = []
    for path in iter_py_files("api"):
        rel = path.relative_to(ROOT).as_posix()
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except SyntaxError as exc:
            errors.append(f"[api] {rel}: syntax error: {exc}")
            continue

        for earlier_route, later_route in _find_shadow_violations(api_routes_ast.scan_file_routes(tree)):
            errors.append(
                f"[api] {rel}:{later_route.lineno}: {_ROUTE_ORDER_MESSAGE} "
                f"({earlier_route.method.upper()} {earlier_route.path!r} раньше "
                f"{later_route.path!r})"
            )
    return errors
