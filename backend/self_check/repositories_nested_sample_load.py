from __future__ import annotations
import re
from self_check._common import ROOT, iter_py_files, line_no

_NESTED_SAMPLE_LOAD = re.compile(r"selectinload\(\s*\w+\.sample\s*\)\.selectinload\(\s*Sample\.(\w+)\s*\)")

# Связи Sample для SampleResponse (@computed_field *_name); см. repositories/sample.py get_sample_by_id.
_SAMPLE_RESPONSE_RELATIONS = frozenset({"laboratory", "department", "branch", "sampling_location"})

_MESSAGE = (
    "частичный nested selectinload для SampleResponse — нужны все связи "
    f"{sorted(_SAMPLE_RESPONSE_RELATIONS)}; вынести в _*_response_load_options() (см. 03-backend nested_response_load)"
)


def collect_errors() -> list[str]:
    """Запретить неполный eager load Sample при вложенном SampleResponse."""
    errors: list[str] = []
    for path in iter_py_files("repositories"):
        text = path.read_text(encoding="utf-8")
        rel = path.relative_to(ROOT).as_posix()
        loaded: set[str] = set()
        first_match: re.Match[str] | None = None
        for match in _NESTED_SAMPLE_LOAD.finditer(text):
            relation = match.group(1)
            if relation not in _SAMPLE_RESPONSE_RELATIONS:
                continue
            if first_match is None:
                first_match = match
            loaded.add(relation)
        if loaded and loaded != _SAMPLE_RESPONSE_RELATIONS and first_match is not None:
            missing = sorted(_SAMPLE_RESPONSE_RELATIONS - loaded)
            errors.append(
                f"[repositories] {rel}:{line_no(text, first_match.start())}: {_MESSAGE}; не хватает: {missing}"
            )
    return errors
