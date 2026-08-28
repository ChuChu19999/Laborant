from __future__ import annotations
from typing import Any
from urllib.parse import quote
from fastapi.responses import Response
import orjson
from starlette.responses import JSONResponse as StarletteJSONResponse


class ORJSONResponse(StarletteJSONResponse):
    """JSON-ответ на базе orjson для сериализации."""

    media_type = "application/json"

    def render(self, content: Any) -> bytes:
        return orjson.dumps(
            content,
            option=(orjson.OPT_NON_STR_KEYS | orjson.OPT_SERIALIZE_NUMPY | orjson.OPT_SERIALIZE_DATACLASS),
        )


def build_attachment_response(
    content: bytes,
    filename: str,
    media_type: str,
    extra_headers: dict[str, str] | None = None,
) -> Response:
    """Сформировать HTTP-ответ с вложением."""
    ascii_filename = filename.encode("ascii", "ignore").decode() or "download"
    encoded_filename = quote(filename, safe="")
    headers = {
        "Content-Disposition": (f"attachment; filename=\"{ascii_filename}\"; filename*=UTF-8''{encoded_filename}"),
    }
    if extra_headers:
        headers.update(extra_headers)
    return Response(
        content=content,
        media_type=media_type,
        headers=headers,
    )
