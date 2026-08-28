from __future__ import annotations
import ast
from dataclasses import dataclass

ROUTER_HTTP_METHODS = frozenset({"get", "post", "put", "patch", "delete", "options", "head"})


@dataclass(frozen=True, slots=True)
class RouteDecl:
    method: str
    path: str
    lineno: int
    func_name: str


def path_segments(path: str) -> list[str]:
    """Разбить путь роутера на сегменты без пустых элементов."""
    return [segment for segment in path.strip("/").split("/") if segment]


def is_path_param(segment: str) -> bool:
    """Вернуть True, если сегмент — path-параметр FastAPI."""
    return segment.startswith("{") and "}" in segment


def extract_path_from_decorator(call: ast.Call) -> str | None:
    """Извлечь строку path из @router.<method>(...)."""
    if call.args and isinstance(call.args[0], ast.Constant) and isinstance(call.args[0].value, str):
        return call.args[0].value
    for keyword in call.keywords:
        if keyword.arg == "path" and isinstance(keyword.value, ast.Constant) and isinstance(keyword.value.value, str):
            return keyword.value.value
    return None


def extract_routes_from_function(node: ast.AsyncFunctionDef | ast.FunctionDef) -> list[RouteDecl]:
    """Собрать объявления @router.<http-method> у handler-функции."""
    routes: list[RouteDecl] = []
    for decorator in node.decorator_list:
        if not isinstance(decorator, ast.Call):
            continue
        if not isinstance(decorator.func, ast.Attribute):
            continue
        if not isinstance(decorator.func.value, ast.Name) or decorator.func.value.id != "router":
            continue
        method = decorator.func.attr
        if method not in ROUTER_HTTP_METHODS:
            continue
        route_path = extract_path_from_decorator(decorator)
        if route_path is None:
            continue
        routes.append(
            RouteDecl(
                method=method,
                path=route_path,
                lineno=decorator.lineno,
                func_name=node.name,
            )
        )
    return routes


def scan_file_routes(tree: ast.AST) -> list[RouteDecl]:
    """Собрать все @router.<method> из модуля api."""
    routes: list[RouteDecl] = []
    for node in tree.body:
        if isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)):
            routes.extend(extract_routes_from_function(node))
    return routes
