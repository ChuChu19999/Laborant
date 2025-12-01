import orjson
from starlette.responses import JSONResponse as StarletteJSONResponse


class ORJSONResponse(StarletteJSONResponse):
    """Кастомный JSONResponse с использованием orjson для улучшения производительности."""

    media_type = "application/json"

    def render(self, content) -> bytes:
        return orjson.dumps(
            content,
            option=orjson.OPT_SERIALIZE_NUMPY | orjson.OPT_SERIALIZE_DATACLASS,
        )
