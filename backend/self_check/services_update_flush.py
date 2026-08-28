from __future__ import annotations
import ast
from self_check._common import ROOT, iter_py_files

_FLUSH_RETURN_MESSAGE = (
    "после записи (flush_entity / add_*) вернуть ORM без перечитывания — "
    "require_*_by_id / refresh_entity (см. 03-backend mutations.after_write_return)"
)

_PARTIAL_REFRESH_MESSAGE = (
    "db.refresh с attribute_names протухает скалярные колонки (updated_at) — "
    "require_*_by_id или полный refresh_entity без attribute_names (§56/§70)"
)


def _call_name(func: ast.AST) -> str | None:
    """Вернуть имя вызываемой функции (в т.ч. obj.method)."""
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return func.attr
    return None


def _is_repo_add_call(call: ast.Call) -> bool:
    """Проверить вызов add_and_flush или *_repo.add_*."""
    name = _call_name(call.func)
    if name == "add_and_flush":
        return True
    return bool(name and name.startswith("add_"))


def _awaited_call(stmt: ast.stmt) -> ast.Call | None:
    """Вернуть Call из await-выражения statement, если есть."""
    if not isinstance(stmt, ast.Expr) or not isinstance(stmt.value, ast.Await):
        return None
    call = stmt.value.value
    return call if isinstance(call, ast.Call) else None


def _is_write_stmt(stmt: ast.stmt) -> bool:
    """Проверить запись в БД: flush_entity, add_and_flush или *_repo.add_*."""
    call = _awaited_call(stmt)
    if call is None:
        return False
    name = _call_name(call.func)
    if name == "flush_entity":
        return True
    return _is_repo_add_call(call)


def _entity_name_from_add_call(call: ast.Call) -> str | None:
    """Вернуть имя ORM-сущности из второго аргумента add_* / add_and_flush."""
    if len(call.args) >= 2 and isinstance(call.args[1], ast.Name):
        return call.args[1].id
    return None


def _track_entity_assign(stmt: ast.stmt, entity_names: set[str]) -> None:
    """Запомнить локальные имена ORM-сущностей из присваиваний."""
    if not isinstance(stmt, ast.Assign) or len(stmt.targets) != 1:
        return
    target = stmt.targets[0]
    if not isinstance(target, ast.Name):
        return
    name = target.id
    if isinstance(stmt.value, ast.Call):
        entity_names.add(name)
        return
    if (
        isinstance(stmt.value, ast.Await)
        and isinstance(stmt.value.value, ast.Call)
        and _is_repo_add_call(stmt.value.value)
    ):
        entity_names.add(name)


def _track_entity_from_write(stmt: ast.stmt, entity_names: set[str]) -> None:
    """Запомнить ORM из аргументов flush/add."""
    call = _awaited_call(stmt)
    if call is None or not _is_repo_add_call(call):
        return
    entity_name = _entity_name_from_add_call(call)
    if entity_name:
        entity_names.add(entity_name)


def _has_attribute_names_kwarg(call: ast.Call) -> bool:
    """Проверить вызов refresh с частичным перечитыванием атрибутов."""
    return any(kw.arg == "attribute_names" for kw in call.keywords)


def _is_refresh_mitigation_call(call: ast.Call) -> bool:
    """Проверить полное перечитывание ORM после flush."""
    name = _call_name(call.func)
    if name == "refresh_entity":
        return True
    if name == "refresh":
        return not _has_attribute_names_kwarg(call)
    return False


def _is_mitigation_stmt(stmt: ast.stmt) -> bool:
    """Проверить перечитывание ORM после flush."""
    if isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Await):
        call = stmt.value.value
        if isinstance(call, ast.Call) and _is_refresh_mitigation_call(call):
            return True
    if isinstance(stmt, ast.Assign) and isinstance(stmt.value, ast.Await):
        call = stmt.value.value
        if isinstance(call, ast.Call):
            name = _call_name(call.func)
            if name and (name.startswith("require_") or name.endswith("_by_id")):
                return True
    return False


def _is_safe_return(return_node: ast.Return) -> bool:
    """Проверить return, не отдающий протухший ORM-параметр."""
    value = return_node.value
    if value is None:
        return True
    if isinstance(value, ast.Await) and isinstance(value.value, ast.Call):
        name = _call_name(value.value.func)
        if name and (
            name.startswith("require_")
            or name.startswith("create_")
            or name.endswith("_by_id")
            or name.startswith("build_")
            or name.startswith("get_")
        ):
            return True
    if isinstance(value, ast.Call):
        name = _call_name(value.func)
        if name and (name.endswith("Response") or name.startswith("build_") or name.startswith("_normalize_")):
            return True
    return False


def _return_is_repo_add(return_node: ast.Return) -> bool:
    """Проверить return await add_* / add_and_flush без re-fetch."""
    value = return_node.value
    if isinstance(value, ast.Await) and isinstance(value.value, ast.Call):
        return _is_repo_add_call(value.value)
    return False


def _is_unsafe_return_after_write(
    return_node: ast.Return,
    param_names: frozenset[str],
    entity_names: set[str],
) -> bool:
    """Проверить return ORM после записи без mitigation."""
    if _is_safe_return(return_node):
        return False
    if _return_is_repo_add(return_node):
        return True
    value = return_node.value
    return isinstance(value, ast.Name) and (value.id in param_names or value.id in entity_names)


def _visit_stmt_list(
    stmts: list[ast.stmt],
    param_names: frozenset[str],
    entity_names: set[str],
    *,
    rel: str,
    flushed_pending: bool,
    mitigated: bool,
    errors: list[str],
) -> None:
    """Проверить список statement'ов на возврат ORM после записи без re-fetch."""
    flushed = flushed_pending
    mitigated_flag = mitigated

    for stmt in stmts:
        _track_entity_assign(stmt, entity_names)

        if _is_write_stmt(stmt):
            _track_entity_from_write(stmt, entity_names)
            flushed = True
            mitigated_flag = False

        if (
            isinstance(stmt, ast.Return)
            and (flushed or _return_is_repo_add(stmt))
            and not mitigated_flag
            and _is_unsafe_return_after_write(stmt, param_names, entity_names)
        ):
            errors.append(f"[services] {rel}:{stmt.lineno}: {_FLUSH_RETURN_MESSAGE}")
        if isinstance(stmt, ast.Return):
            continue

        if flushed and _is_mitigation_stmt(stmt):
            mitigated_flag = True

        if isinstance(stmt, ast.If):
            _visit_stmt_list(
                stmt.body,
                param_names,
                entity_names,
                rel=rel,
                flushed_pending=flushed,
                mitigated=mitigated_flag,
                errors=errors,
            )
            _visit_stmt_list(
                stmt.orelse,
                param_names,
                entity_names,
                rel=rel,
                flushed_pending=flushed,
                mitigated=mitigated_flag,
                errors=errors,
            )
            continue

        for child_attr in ("body", "orelse", "finalbody", "handlers"):
            child = getattr(stmt, child_attr, None)
            if not child:
                continue
            if child_attr == "handlers":
                for handler in child:
                    if handler.body:
                        _visit_stmt_list(
                            handler.body,
                            param_names,
                            entity_names,
                            rel=rel,
                            flushed_pending=flushed,
                            mitigated=mitigated_flag,
                            errors=errors,
                        )
            else:
                _visit_stmt_list(
                    child,
                    param_names,
                    entity_names,
                    rel=rel,
                    flushed_pending=flushed,
                    mitigated=mitigated_flag,
                    errors=errors,
                )


def _should_scan_mutation_function(name: str) -> bool:
    """Проверить, что функция — create_* / update_* с возвратом ORM (не *_for_response)."""
    if name.endswith("_for_response"):
        return False
    return name.startswith("update_") or name.startswith("create_")


def _scan_mutation_flush_return() -> list[str]:
    """Запретить return ORM после записи без re-fetch в create_* и update_*."""
    errors: list[str] = []
    for path in iter_py_files("services"):
        rel = path.relative_to(ROOT).as_posix()
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except SyntaxError as exc:
            errors.append(f"[services] {rel}: syntax error: {exc}")
            continue

        for node in tree.body:
            if not isinstance(node, ast.AsyncFunctionDef):
                continue
            if not _should_scan_mutation_function(node.name):
                continue
            param_names = frozenset(arg.arg for arg in node.args.args)
            entity_names: set[str] = set()
            _visit_stmt_list(
                node.body,
                param_names,
                entity_names,
                rel=rel,
                flushed_pending=False,
                mitigated=False,
                errors=errors,
            )
    return errors


def _scan_partial_refresh(layer: str) -> list[str]:
    """Запретить db.refresh(..., attribute_names=...) в services и repositories."""
    errors: list[str] = []
    for path in iter_py_files(layer):
        rel = path.relative_to(ROOT).as_posix()
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except SyntaxError as exc:
            errors.append(f"[services] {rel}: syntax error: {exc}")
            continue

        for node in ast.walk(tree):
            if not isinstance(node, ast.Await):
                continue
            call = node.value
            if not isinstance(call, ast.Call):
                continue
            if _call_name(call.func) != "refresh":
                continue
            if not _has_attribute_names_kwarg(call):
                continue
            errors.append(f"[services] {rel}:{node.lineno}: {_PARTIAL_REFRESH_MESSAGE}")
    return errors


def collect_errors() -> list[str]:
    """Собрать нарушения flush→return ORM и частичного refresh в services."""
    errors = _scan_mutation_flush_return()
    errors.extend(_scan_partial_refresh("services"))
    errors.extend(_scan_partial_refresh("repositories"))
    return errors
