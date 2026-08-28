from __future__ import annotations
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from enum import Enum
import importlib
import pkgutil
from types import ModuleType, NoneType, UnionType
from typing import Annotated, Any, Literal, Union, get_args, get_origin
from uuid import UUID
from pydantic import BaseModel, ValidationError
from pydantic_core import PydanticUndefined


def _iter_schema_modules() -> list[ModuleType]:
    """Импортировать все подмодули пакета schemas."""
    package = importlib.import_module("schemas")
    modules = [package]
    for module_info in pkgutil.iter_modules(package.__path__, package.__name__ + "."):
        modules.append(importlib.import_module(module_info.name))
    return modules


def _iter_model_classes(modules: list[ModuleType]) -> list[type[BaseModel]]:
    """Собрать уникальные подклассы BaseModel из модулей schemas."""
    seen: set[type[BaseModel]] = set()
    models: list[type[BaseModel]] = []
    for module in modules:
        for value in vars(module).values():
            if not isinstance(value, type) or not issubclass(value, BaseModel) or value is BaseModel:
                continue
            if value in seen:
                continue
            seen.add(value)
            models.append(value)
    return models


def _annotation_allows_none(annotation: Any) -> bool:
    """Вернуть True, если аннотация допускает None (в т.ч. через Annotated/Union)."""
    if annotation is None or annotation is NoneType:
        return True
    origin = get_origin(annotation)
    args = get_args(annotation)
    if origin is Annotated and args:
        return _annotation_allows_none(args[0])
    if origin in (Union, UnionType):
        return any(_annotation_allows_none(arg) for arg in args)
    return False


def _unwrap_annotated(annotation: Any) -> Any:
    """Снять оболочку Annotated, оставив основной тип."""
    origin = get_origin(annotation)
    if origin is Annotated:
        args = get_args(annotation)
        return _unwrap_annotated(args[0]) if args else annotation
    return annotation


def _non_none_union_args(annotation: Any) -> tuple[Any, ...]:
    """Вернуть ветки union без None."""
    unwrapped = _unwrap_annotated(annotation)
    origin = get_origin(unwrapped)
    if origin in (Union, UnionType):
        return tuple(arg for arg in get_args(unwrapped) if arg is not NoneType)
    return (unwrapped,)


def _dummy_for_annotation(annotation: Any, *, depth: int = 0) -> Any:
    """Построить минимальное значение для поля (не None)."""
    if depth > 6:
        return "x"
    unwrapped = _unwrap_annotated(annotation)
    if _annotation_allows_none(unwrapped):
        branches = _non_none_union_args(unwrapped)
        if not branches:
            return "x"
        return _dummy_for_annotation(branches[0], depth=depth + 1)

    origin = get_origin(unwrapped)
    args = get_args(unwrapped)

    if origin is Literal and args:
        return args[0]
    if origin in (list, set, frozenset):
        return []
    if origin is dict:
        return {}
    if origin is tuple:
        if args and args[-1] is not Ellipsis:
            return tuple(_dummy_for_annotation(arg, depth=depth + 1) for arg in args)
        return ()

    if isinstance(unwrapped, type):
        if issubclass(unwrapped, BaseModel):
            return _build_filled_payload(unwrapped, depth=depth + 1)
        if issubclass(unwrapped, Enum):
            members = list(unwrapped)
            return members[0].value if members else "x"
        if unwrapped is str:
            return "x"
        if unwrapped is bytes:
            return b"x"
        if unwrapped is bool:
            return False
        if unwrapped is int:
            return 1
        if unwrapped is float:
            return 1.0
        if unwrapped is Decimal:
            return Decimal("1")
        if unwrapped is datetime:
            return datetime(2000, 1, 1)
        if unwrapped is date:
            return date(2000, 1, 1)
        if unwrapped is time:
            return time(0, 0)
        if unwrapped is timedelta:
            return timedelta(0)
        if unwrapped is UUID:
            return UUID("00000000-0000-0000-0000-000000000001")
        if unwrapped is Any:
            return {}

    branches = _non_none_union_args(unwrapped)
    if len(branches) == 1 and branches[0] is not unwrapped:
        return _dummy_for_annotation(branches[0], depth=depth + 1)
    return "x"


def _build_filled_payload(model: type[BaseModel], *, depth: int = 0) -> dict[str, Any]:
    """Собрать payload со заглушками для всех полей (без принудительного None)."""
    payload: dict[str, Any] = {}
    for field_name, field_info in model.model_fields.items():
        if field_info.exclude:
            continue
        if not field_info.is_required():
            if field_info.default is not PydanticUndefined:
                payload[field_name] = field_info.default
                continue
            if field_info.default_factory is not None:
                payload[field_name] = field_info.get_default(call_default_factory=True)
                continue
        annotation = field_info.annotation
        payload[field_name] = None if annotation is None else _dummy_for_annotation(annotation, depth=depth)
    return payload


def _is_constraint_none_error(exc: BaseException) -> bool:
    """Распознать TypeError Pydantic на constraints при value=None."""
    message = str(exc)
    return "Unable to apply constraint" in message or (
        isinstance(exc, TypeError) and "NoneType" in message and "len" in message
    )


def collect_optional_constraint_errors() -> list[str]:
    """Найти nullable-поля schemas, на которых model_validate(None) ломает constraints."""
    errors: list[str] = []
    for model in _iter_model_classes(_iter_schema_modules()):
        nullable_fields = [
            name
            for name, field in model.model_fields.items()
            if not field.exclude and field.annotation is not None and _annotation_allows_none(field.annotation)
        ]
        if not nullable_fields:
            continue
        try:
            base_payload = _build_filled_payload(model)
        except Exception as exc:  # noqa: BLE001 — не удалось собрать заглушки модели
            errors.append(f"{model.__module__}.{model.__name__}: не собрали payload: {type(exc).__name__}: {exc}")
            continue

        for field_name in nullable_fields:
            payload = dict(base_payload)
            payload[field_name] = None
            try:
                model.model_validate(payload)
            except ValidationError:
                continue
            except Exception as exc:  # noqa: BLE001 — ищем constraint TypeError среди прочих
                if _is_constraint_none_error(exc):
                    errors.append(f"{model.__module__}.{model.__name__}.{field_name}: {exc}")
    return errors


def assert_optional_constraints_accept_none() -> None:
    """Упасть, если optional-поле schemas не принимает None из-за constraints."""
    errors = collect_optional_constraint_errors()
    if errors:
        joined = "\n".join(f"  - {item}" for item in errors)
        raise RuntimeError(
            "Pydantic schemas: optional-поле не принимает None "
            "(часто Annotated[..., Field(max_length=N)] вместо Field(..., max_length=N)):\n"
            f"{joined}"
        )
