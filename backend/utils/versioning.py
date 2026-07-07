def next_version_string(current_version: str | None) -> str:
    """Следующая версия шаблона или прибора в формате vN."""
    if not current_version:
        return "v1"
    try:
        return f"v{int(current_version[1:]) + 1}"
    except (ValueError, IndexError):
        return "v1"
