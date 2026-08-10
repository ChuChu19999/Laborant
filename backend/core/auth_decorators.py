from __future__ import annotations
from collections.abc import Callable
import functools
import inspect
from fastapi import Depends
from core.security import get_current_user
from utils.current_user import set_current_user


def IsAuthenticated(func: Callable) -> Callable:
    """Декоратор для защиты эндпоинтов авторизацией."""
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
        decoded_token = None
        if has_decoded_token and "decoded_token" in kwargs:
            decoded_token = kwargs.get("decoded_token")
        elif not has_decoded_token and "decoded_token" in kwargs:
            decoded_token = kwargs.get("decoded_token")
            kwargs.pop("decoded_token", None)

        if decoded_token:
            full_name = decoded_token.get("fullName") or ""
            hsnils = decoded_token.get("hashSnils") or ""
            if full_name and hsnils:
                set_current_user(full_name, hsnils)

        return await func(*args, **kwargs)

    wrapper.__signature__ = new_sig
    return wrapper
