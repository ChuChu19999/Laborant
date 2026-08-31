from __future__ import annotations
import hashlib
import re

MESSAGE_MAX_LENGTH = 500
STACK_MAX_LENGTH = 1200
SUMMARY_MAX_LENGTH = 280
TOP_FRAME_MAX_LENGTH = 200
LINE_MAX_LENGTH = 160
MAX_APP_FRAMES = 4
MAX_FALLBACK_FRAMES = 2

_NUMERIC_PATH_SEGMENT = re.compile(r"^\d+$")
_PYTHON_FILE_RE = re.compile(r'^File "([^"]+)", line (\d+), in (.+)$')
_PYTHON_EXCEPTION_RE = re.compile(r"^([\w.]*(?:Error|Exception|Warning|Exit|Interrupt)(?:Group)?):\s*(.*)$")
_JS_AT_RE = re.compile(r"^at\s+(.+)$")
_JS_EXCEPTION_RE = re.compile(r"^(\w*Error):\s*(.+)$")

_FRAMEWORK_MARKERS = (
    "site-packages",
    "/lib/python",
    "\\lib\\python",
    "uvicorn/",
    "starlette/",
    "fastapi/",
    "sqlalchemy/",
    "anyio/",
    "asyncio/",
    "contextlib.py",
    "importlib/",
    "pydantic/",
    "httpx/",
    "httpcore/",
    "vendor/",
    "concurrent/",
)

_APP_MARKERS = (
    "/backend/",
    "\\backend\\",
    "/repositories/",
    "/services/",
    "/api/",
    "/models/",
    "/schemas/",
    "/core/",
    "/utils/",
    "/src/",
    "\\src\\",
    "Laborant",
)

_NODE_MODULES_MARKERS = (
    "node_modules",
    "webpack",
    "@vite",
    "chunk-",
    "vite/deps",
)


def truncate_text(text: str, max_length: int) -> str:
    """Укоротить текст с многоточием, если он длиннее лимита."""
    if len(text) <= max_length:
        return text
    if max_length <= 1:
        return text[:max_length]
    return text[: max_length - 1] + "…"


def normalize_path(path: str | None) -> str | None:
    """Нормализовать путь: числовые сегменты заменить на :id."""
    if not path:
        return None
    segments: list[str] = []
    for segment in path.split("/"):
        if not segment:
            segments.append(segment)
            continue
        if _NUMERIC_PATH_SEGMENT.match(segment):
            segments.append(":id")
        else:
            segments.append(segment)
    return "/".join(segments)


def _normalize_fs_path(path: str) -> str:
    return path.replace("\\", "/")


def _is_framework_path(path: str) -> bool:
    lower = _normalize_fs_path(path).lower()
    return any(marker.replace("\\", "/").lower() in lower for marker in _FRAMEWORK_MARKERS)


def _is_app_path(path: str) -> bool:
    lower = _normalize_fs_path(path).lower()
    return any(marker.replace("\\", "/").lower() in lower for marker in _APP_MARKERS)


def _short_path(path: str) -> str:
    normalized = _normalize_fs_path(path)
    for marker in _APP_MARKERS:
        marker_normalized = marker.replace("\\", "/")
        idx = normalized.find(marker_normalized)
        if idx >= 0:
            return normalized[idx + len(marker_normalized) :].lstrip("/")
    return normalized.rsplit("/", 1)[-1]


def _short_js_location(location: str) -> str:
    """Сократить JS-фрейм до пути в src и позиции."""
    func_name = ""
    path_part = location
    if location.endswith(")") and "(" in location:
        func_name, path_part = location.rsplit("(", 1)
        func_name = func_name.strip()
        path_part = path_part.rstrip(")").strip()

    if path_part.startswith("http://") or path_part.startswith("https://"):
        slash_src = path_part.find("/src/")
        path_part = path_part[slash_src + 1 :] if slash_src >= 0 else path_part.rsplit("/", 1)[-1]

    path_part = path_part.replace("\\", "/")
    if path_part.startswith("src/"):
        path_part = path_part[4:]

    if func_name:
        return f"{path_part} in {func_name}"
    return path_part


def compact_error_message(message: str) -> str:
    """Убрать traceback из сообщения и оставить тип и текст исключения."""
    stripped = message.strip()
    if not stripped:
        return stripped

    if "Traceback (most recent call last)" in stripped:
        for line in reversed(stripped.splitlines()):
            candidate = line.strip()
            if not candidate:
                continue
            if _PYTHON_EXCEPTION_RE.match(candidate):
                return candidate
            if candidate.startswith("raise "):
                continue
            if candidate.startswith("File "):
                continue
        return truncate_text(stripped.splitlines()[-1].strip(), MESSAGE_MAX_LENGTH)

    first_line = stripped.splitlines()[0].strip()
    if first_line.startswith("Error:") or _JS_EXCEPTION_RE.match(first_line):
        return first_line

    return stripped


def _compact_python_traceback(text: str) -> str:
    file_frames: list[tuple[str, int, str]] = []
    exception_line = ""
    code_line = ""

    for raw_line in text.splitlines():
        stripped = raw_line.strip()
        if not stripped or stripped == "Traceback (most recent call last):":
            continue

        file_match = _PYTHON_FILE_RE.match(stripped)
        if file_match:
            path, line_no, func = file_match.groups()
            file_frames.append((path, int(line_no), func))
            code_line = ""
            continue

        if _PYTHON_EXCEPTION_RE.match(stripped):
            exception_line = stripped
            continue

        if file_frames and not code_line and not stripped.startswith("at "):
            code_line = truncate_text(stripped, LINE_MAX_LENGTH)

    app_frames = [frame for frame in file_frames if _is_app_path(frame[0]) and not _is_framework_path(frame[0])]
    if not app_frames:
        app_frames = [frame for frame in file_frames if not _is_framework_path(frame[0])]
    if not app_frames:
        app_frames = file_frames[-MAX_FALLBACK_FRAMES:]

    selected_frames = app_frames[-MAX_APP_FRAMES:]

    parts: list[str] = []
    if exception_line:
        parts.append(exception_line)
    elif text.splitlines():
        parts.append(truncate_text(text.splitlines()[-1].strip(), LINE_MAX_LENGTH))

    for path, line_no, func in selected_frames:
        parts.append(f"  {_short_path(path)}:{line_no} in {func}")

    if code_line and selected_frames:
        parts.append(f"    {code_line}")

    return "\n".join(parts)


def _compact_js_stack(text: str) -> str:
    lines = [line for line in text.splitlines() if line.strip()]
    if not lines:
        return truncate_text(text, STACK_MAX_LENGTH)

    parts: list[str] = []
    at_lines: list[str] = []

    first_line = lines[0].strip()
    if first_line.startswith("Error:") or _JS_EXCEPTION_RE.match(first_line):
        parts.append(first_line)

    for raw_line in lines[1:]:
        stripped = raw_line.strip()
        at_match = _JS_AT_RE.match(stripped)
        if not at_match:
            continue
        location = at_match.group(1)
        if any(marker in location for marker in _NODE_MODULES_MARKERS):
            continue
        at_lines.append(f"  at {_short_js_location(location)}")

    parts.extend(at_lines[-MAX_APP_FRAMES:])
    return "\n".join(parts) if parts else truncate_text(text, STACK_MAX_LENGTH)


def compact_stack_trace(stack_trace: str | None) -> str | None:
    """Сжать стек: тип ошибки, фреймы кода приложения, без шума фреймворков."""
    if not stack_trace:
        return None
    text = stack_trace.strip()
    if not text:
        return None

    if "Traceback (most recent call last)" in text or _PYTHON_FILE_RE.search(text):
        compacted = _compact_python_traceback(text)
    elif text.startswith("Error") or " at " in text or "\n    at " in text or "\n at " in text:
        compacted = _compact_js_stack(text)
    else:
        compacted = truncate_text(text, STACK_MAX_LENGTH)

    return truncate_text(compacted, STACK_MAX_LENGTH) if compacted else None


def extract_top_stack_frame(stack_trace: str | None) -> str:
    """Взять верхнюю значимую строку стека для fingerprint и краткого описания."""
    if not stack_trace:
        return ""

    compacted = compact_stack_trace(stack_trace)
    if compacted:
        for line in compacted.splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            if stripped.startswith("at "):
                return truncate_text(stripped[3:].strip(), TOP_FRAME_MAX_LENGTH)
            if _PYTHON_EXCEPTION_RE.match(stripped):
                continue
            if stripped.startswith("File "):
                return truncate_text(stripped, TOP_FRAME_MAX_LENGTH)
            return truncate_text(stripped, TOP_FRAME_MAX_LENGTH)

    for line in stack_trace.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("at ") or stripped.startswith("File ") or "line" in stripped.lower():
            return truncate_text(stripped, TOP_FRAME_MAX_LENGTH)

    first_line = stack_trace.splitlines()[0].strip()
    return truncate_text(first_line, TOP_FRAME_MAX_LENGTH)


def compute_error_fingerprint(
    *,
    source: str,
    severity: str,
    message: str,
    path: str | None,
    top_frame: str,
) -> str:
    """Построить стабильный fingerprint уникальной ошибки."""
    normalized_message = truncate_text(compact_error_message(message).strip(), 300)
    normalized_path = normalize_path(path) or ""
    key = f"{source}\0{severity}\0{normalized_message}\0{normalized_path}\0{top_frame}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def build_error_summary(
    *,
    message: str,
    stack_trace: str | None,
    path: str | None,
) -> str:
    """Собрать короткое описание ошибки для списка мониторинга."""
    parts: list[str] = []
    normalized_path = normalize_path(path)
    if normalized_path:
        parts.append(normalized_path)
    parts.append(truncate_text(compact_error_message(message).strip(), 120))
    top_frame = extract_top_stack_frame(stack_trace)
    if top_frame:
        parts.append(top_frame)
    return truncate_text(" | ".join(parts), SUMMARY_MAX_LENGTH)


def prepare_error_payload(
    *,
    message: str,
    stack_trace: str | None,
    path: str | None,
) -> tuple[str, str | None, str, str]:
    """Подготовить укороченные поля ошибки и summary для записи в БД."""
    trimmed_message = truncate_text(compact_error_message(message), MESSAGE_MAX_LENGTH)
    trimmed_stack = compact_stack_trace(stack_trace)
    summary = build_error_summary(message=trimmed_message, stack_trace=trimmed_stack, path=path)
    top_frame = extract_top_stack_frame(trimmed_stack or stack_trace)
    return trimmed_message, trimmed_stack, summary, top_frame
