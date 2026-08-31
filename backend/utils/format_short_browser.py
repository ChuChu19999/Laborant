from __future__ import annotations
import re

_UNKNOWN_BROWSER = "Неизвестный браузер"

_BROWSER_MATCHERS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("Edge", re.compile(r"Edg(?:e|A|iOS)?/(\d+)", re.IGNORECASE)),
    ("Opera", re.compile(r"(?:OPR|Opera)/(\d+)", re.IGNORECASE)),
    ("Chrome", re.compile(r"(?:Chrome|CriOS)/(\d+)", re.IGNORECASE)),
    ("Firefox", re.compile(r"(?:Firefox|FxiOS)/(\d+)", re.IGNORECASE)),
    ("Safari", re.compile(r"Version/(\d+)", re.IGNORECASE)),
    ("IE", re.compile(r"(?:MSIE (\d+)|Trident/.*rv:(\d+))", re.IGNORECASE)),
)


def format_short_browser(user_agent: str | None) -> str | None:
    """Вернуть короткое имя браузера и мажорную версию, например «Chrome 151»."""
    normalized = user_agent.strip() if user_agent else ""
    if not normalized:
        return None

    for label, pattern in _BROWSER_MATCHERS:
        match = pattern.search(normalized)
        if not match:
            continue

        version = next((group for group in match.groups() if group), None)
        if version:
            return f"{label} {version}"
        return label

    if re.search(r"Safari", normalized, re.IGNORECASE) and not re.search(
        r"Chrome|Chromium|Edg", normalized, re.IGNORECASE
    ):
        return "Safari"

    return _UNKNOWN_BROWSER
