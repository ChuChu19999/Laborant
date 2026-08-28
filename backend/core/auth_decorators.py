from __future__ import annotations
from collections.abc import Callable
import functools
import inspect
from typing import Any, cast
from fastapi import Depends
from core.security import get_current_user


def IsAuthenticated(func: Callable) -> Callable:
    """Защитить эндпоинт авторизацией через Depends(get_current_user)."""
    sig = inspect.signature(func)
    params = list(sig.parameters.values())

    has_decoded_token = any(p.name == "decoded_token" for p in params)

    if not has_decoded_token:
        params.append(
            inspect.Parameter(
                "decoded_token",
                inspect.Parameter.KEYWORD_ONLY,
                default=Depends(get_current_user),
                annotation=dict,
            )
        )
        new_sig = sig.replace(parameters=params)
    else:
        new_sig = sig

    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        if not has_decoded_token:
            kwargs.pop("decoded_token", None)
        return await func(*args, **kwargs)

    cast(Any, wrapper).__signature__ = new_sig
    return wrapper
