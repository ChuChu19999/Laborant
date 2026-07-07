from __future__ import annotations
from urllib.parse import quote
from fastapi.responses import Response


def build_attachment_response(
    content: bytes, filename: str, media_type: str
) -> Response:
    """Сформировать HTTP-ответ с вложением."""
    encoded_filename = quote(filename, safe="")
    content_disposition = f"attachment; filename*=UTF-8''{encoded_filename}"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": content_disposition},
    )
