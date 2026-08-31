from functools import lru_cache
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
import tomllib

_PYPROJECT_PATH = Path(__file__).resolve().parent.parent / "pyproject.toml"


def _read_pyproject_version() -> str | None:
    """Прочитать version из pyproject.toml, если пакет не установлен в окружении."""
    if not _PYPROJECT_PATH.is_file():
        return None
    with _PYPROJECT_PATH.open("rb") as file:
        data = tomllib.load(file)
    project = data.get("project")
    if not isinstance(project, dict):
        return None
    raw_version = project.get("version")
    if not isinstance(raw_version, str) or not raw_version.strip():
        return None
    return raw_version.strip()


@lru_cache
def get_app_version() -> str:
    """Вернуть версию backend: из установленного пакета или из pyproject.toml."""
    try:
        return version("laborant-backend")
    except PackageNotFoundError:
        pyproject_version = _read_pyproject_version()
        if pyproject_version is not None:
            return pyproject_version
        return "0.0.0"
