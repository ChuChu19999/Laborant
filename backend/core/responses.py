from __future__ import annotations
from urllib.parse import quote
import orjson
from fastapi.responses import Response
from starlette.responses import JSONResponse as StarletteJSONResponse


class ORJSONResponse(StarletteJSONResponse):
    """Кастомный JSONResponse с использованием orjson для улучшения производительности."""

    media_type = "application/json"

    def render(self, content) -> bytes:
        return orjson.dumps(
            content,
            option=orjson.OPT_SERIALIZE_NUMPY | orjson.OPT_SERIALIZE_DATACLASS,
        )


def build_attachment_response(
    content: bytes,
    filename: str,
    media_type: str,
    extra_headers: dict[str, str] | None = None,
) -> Response:
    """Сформировать HTTP-ответ с вложением."""
    encoded_filename = quote(filename, safe="")
    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
    }
    if extra_headers:
        headers.update(extra_headers)
    return Response(
        content=content,
        media_type=media_type,
        headers=headers,
    )
