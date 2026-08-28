from __future__ import annotations
import ast
from self_check._common import ROOT, iter_py_files

_MESSAGE = (
    "BackgroundTasks и request-scoped AsyncSession в одном handler — "
    "после ответа get_db закроет сессию; фоновая задача не должна использовать db"
)

_SESSION_PARAM_NAMES = frozenset({"db", "session"})


def _annotation_text(node: ast.expr | None) -> str:
    if node is None:
        return ""
    return ast.unparse(node)


def _is_background_tasks_param(arg: ast.arg) -> bool:
    if arg.arg == "background_tasks":
        return True
    annotation = _annotation_text(arg.annotation)
    return "BackgroundTasks" in annotation


def _is_session_param(arg: ast.arg) -> bool:
    if arg.arg in _SESSION_PARAM_NAMES:
        return True
    annotation = _annotation_text(arg.annotation)
    return "AsyncSession" in annotation or "DbSession" in annotation


def _handler_uses_background_tasks_with_session(node: ast.AsyncFunctionDef | ast.FunctionDef) -> bool:
    params = [*node.args.args, *node.args.kwonlyargs]
    has_background_tasks = any(_is_background_tasks_param(param) for param in params)
    has_session = any(_is_session_param(param) for param in params)
    return has_background_tasks and has_session


def _is_router_handler(node: ast.AsyncFunctionDef | ast.FunctionDef) -> bool:
    for decorator in node.decorator_list:
        if not isinstance(decorator, ast.Call):
            continue
        if not isinstance(decorator.func, ast.Attribute):
            continue
        if isinstance(decorator.func.value, ast.Name) and decorator.func.value.id == "router":
            return True
    return False


def collect_errors() -> list[str]:
    """Запретить BackgroundTasks вместе с request-scoped сессией в api handler."""
    errors: list[str] = []
    for path in iter_py_files("api"):
        rel = path.relative_to(ROOT).as_posix()
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except SyntaxError as exc:
            errors.append(f"[api] {rel}: syntax error: {exc}")
            continue

        for node in tree.body:
            if not isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)):
                continue
            if not _is_router_handler(node):
                continue
            if not _handler_uses_background_tasks_with_session(node):
                continue
            errors.append(f"[api] {rel}:{node.lineno}: {_MESSAGE} ({node.name})")
    return errors
