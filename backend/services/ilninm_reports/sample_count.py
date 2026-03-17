"""
Отчёт «Количество проб» для лаборатории ИЛНиНМ.

Собирает по пробам за период (по дате получения) количество расчётов и показателей,
группирует по типам строк отчёта и по branch_id. Пустые строки (0 шт / 0 пок) не выводятся.
В отчёт попадают только неудалённые пробы (deleted_at IS NULL) и неудалённые расчёты.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Optional
import pendulum
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.calculation import Calculation
from models.laboratory import Branch, SamplingLocation
from models.sample import Sample
from utils.filters import add_date_range_filter
from .constants import (
    BRANCH_NGDU,
    BRANCH_UGPU,
    DISPLAY_NAMES_CDGGKN,
    LABORATORY_NAME_ILNINM,
    ROW_TITLE_DIZTOPIVO,
    ROW_TITLE_DIZTOPIVO_INGIBITOR,
    ROW_TITLE_EKSPLUATACIONNAYA_NEFT_NGDU,
    ROW_TITLE_GKP_21,
    ROW_TITLE_GKP_21_GKP_22,
    ROW_TITLE_GKP_22,
    ROW_TITLE_INGIBITOR_KORROZII,
    ROW_TITLE_KALIBROVOCHNAYA_NEFT_UGPU,
    ROW_TITLE_OIS,
    ROW_TITLE_OIS_ACHIMOVKA,
    ROW_TITLE_PASPORTIZACIYA,
    ROW_TITLE_PROCHIE,
    ROW_TITLE_TOVARNAYA_NEFT_NGDU,
    ROW_TITLE_TOVARNAYA_PRODUKCIYA_OIS,
    SAMPLING_LOCATIONS_CDGGKN,
    SAMPLING_LOCATIONS_GKP,
)


@dataclass
class SampleCalcStats:
    """Количество расчётов и уникальных показателей (research_method_id) по пробе."""

    sample_id: int
    cnt: int
    pok: int


@dataclass
class BranchRows:
    """Строки отчёта по одному филиалу."""

    branch_id: int
    branch_name: str
    rows: list[dict[str, str]] = field(default_factory=list)


def _fmt_date(d: Optional[pendulum.Date]) -> str:
    if d is None:
        return ""
    return pendulum.instance(d).format("DD.MM.YYYY")


def _normalize_title(raw: Optional[str]) -> str:
    if raw is None:
        return ""
    return (raw or "").strip()


def _match_row_title(cell_a: str, title: str) -> bool:
    """Сопоставление значения ячейки A с ключом строки (без учёта регистра и пробелов)."""
    return _normalize_title(cell_a).lower() == title.lower()


async def _get_ilninm_laboratory_id(db: AsyncSession) -> Optional[int]:
    from models.laboratory import Laboratory

    r = await db.execute(
        select(Laboratory.id).where(
            Laboratory.name == LABORATORY_NAME_ILNINM,
            Laboratory.deleted_at.is_(None),
        )
    )
    return r.scalar_one_or_none()


async def _get_samples_in_range(
    db: AsyncSession,
    laboratory_id: int,
    receiving_date_from: Optional[pendulum.DateTime],
    receiving_date_to: Optional[pendulum.DateTime],
    department_id: Optional[int] = None,
) -> list[Sample]:
    """Пробы за период по дате получения с загрузкой branch и sampling_location."""
    conditions = [Sample.laboratory_id == laboratory_id, Sample.deleted_at.is_(None)]
    add_date_range_filter(
        conditions, receiving_date_from, receiving_date_to, Sample.receiving_date
    )
    if department_id is not None:
        conditions.append(Sample.department_id == department_id)
    query = (
        select(Sample)
        .where(*conditions)
        .options(
            selectinload(Sample.branch),
            selectinload(Sample.sampling_location),
        )
    )
    result = await db.execute(query)
    return list(result.scalars().unique().all())


async def _get_calc_agg_by_sample(
    db: AsyncSession, sample_ids: list[int]
) -> dict[int, tuple[int, int]]:
    """По каждому sample_id: (число расчётов, число уникальных показателей)."""
    if not sample_ids:
        return {}
    sub = (
        select(
            Calculation.sample_id,
            func.count(Calculation.id).label("cnt"),
            func.count(func.distinct(Calculation.research_method_id)).label("pok"),
        )
        .where(
            Calculation.sample_id.in_(sample_ids),
            Calculation.deleted_at.is_(None),
        )
        .group_by(Calculation.sample_id)
    )
    r = await db.execute(sub)
    return {row.sample_id: (row.cnt, row.pok) for row in r.all()}


def _test_object_equals(s: Sample, value: str) -> bool:
    return (s.test_object or "").strip().lower() == value.lower()


def _test_object_ilike(s: Sample, part: str) -> bool:
    return part.lower() in (s.test_object or "").lower()


def _test_object_not_equals(s: Sample, value: str) -> bool:
    return (s.test_object or "").strip().lower() != value.lower()


def _sampling_location_name_in(s: Sample, names: tuple[str, ...]) -> bool:
    if not s.sampling_location:
        return False
    return (s.sampling_location.name or "").strip() in names


def _sampling_location_name_not_in(s: Sample, names: tuple[str, ...]) -> bool:
    if not s.sampling_location:
        return True
    return (s.sampling_location.name or "").strip() not in names


def _branch_name_equals(s: Sample, name: str) -> bool:
    if not s.branch:
        return False
    return (s.branch.name or "").strip() == name


def _sample_type_equals(s: Sample, value: str) -> bool:
    return (s.sample_type or "").strip() == value


def _build_tovarnaya_neft_ngdu(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> str:
    """Товарная нефть НГДУ: test_object «нефть», branch НГДУ, не ЦДГГКН №1/№2."""
    items = [
        s
        for s in samples
        if _branch_name_equals(s, BRANCH_NGDU)
        and _test_object_ilike(s, "нефть")
        and not _test_object_ilike(s, "нефть калибровочная")
        and not _test_object_ilike(s, "нефть товарная")
        and _sampling_location_name_not_in(s, SAMPLING_LOCATIONS_CDGGKN)
    ]
    if not items:
        return ""
    total_cnt = sum(agg.get(s.id, (0, 0))[0] for s in items)
    if total_cnt == 0:
        return ""
    all_pok = set()
    for s in items:
        _, pok = agg.get(s.id, (0, 0))
        if pok > 0:
            all_pok.add((s.id, pok))
    pok_count = sum(p for _, p in all_pok) if all_pok else 0
    if pok_count == 0:
        pok_count = sum(agg.get(s.id, (0, 0))[1] for s in items)
    return f"{len(items)} шт по {pok_count} пок"


def _build_ekspluatacionnaya_neft_ngdu(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> str:
    """Эксплуатационная нефть НГДУ: по ЦДГГКН №1 и №2, с скважиной и датой получения."""
    items = [
        s
        for s in samples
        if _branch_name_equals(s, BRANCH_NGDU)
        and _test_object_ilike(s, "нефть")
        and _sampling_location_name_in(s, SAMPLING_LOCATIONS_CDGGKN)
        and s.well
    ]
    if not items:
        return ""
    by_loc: dict[str, list[Sample]] = defaultdict(list)
    for s in items:
        name = (s.sampling_location.name or "").strip()
        by_loc[name].append(s)
    lines = []
    for loc_name in ("Цех по ДГГКН №1", "Цех по ДГГКН №2"):
        loc_samples = by_loc.get(loc_name, [])
        if not loc_samples:
            continue
        cnt = len(loc_samples)
        pok = sum(agg.get(s.id, (0, 0))[1] for s in loc_samples)
        if cnt == 0 and pok == 0:
            continue
        display_name = DISPLAY_NAMES_CDGGKN.get(loc_name, loc_name)
        lines.append(f"{cnt} шт по {pok} пок")
        for s in sorted(
            loc_samples,
            key=lambda x: (x.receiving_date or pendulum.date(1900, 1, 1), x.well or ""),
        ):
            lines.append(
                f"{display_name} скв. {s.well} от {_fmt_date(s.receiving_date)}"
            )
    return "\n".join(lines) if lines else ""


def _build_kalibrovochnaya_neft_ugpu(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> str:
    """Калибровочная нефть УГПУ: по ЦДГГКН №1 и №2, branch УГПУ, без показателей по группам."""
    items = [
        s
        for s in samples
        if _branch_name_equals(s, BRANCH_UGPU)
        and _test_object_ilike(s, "нефть калибровочная")
        and _sampling_location_name_in(s, SAMPLING_LOCATIONS_CDGGKN)
    ]
    if not items:
        return ""
    by_loc: dict[str, int] = defaultdict(int)
    for s in items:
        name = (s.sampling_location.name or "").strip()
        by_loc[name] += 1
    parts = [
        f"{c} шт"
        for loc_name in ("Цех по ДГГКН №2", "Цех по ДГГКН №1")
        for c in [by_loc.get(loc_name, 0)]
        if c > 0
    ]
    if not parts:
        return ""
    lines = [f"{sum(by_loc.values())} шт"]
    for loc_name in ("Цех по ДГГКН №2", "Цех по ДГГКН №1"):
        if by_loc.get(loc_name, 0) > 0:
            lines.append(DISPLAY_NAMES_CDGGKN.get(loc_name, loc_name))
    return "\n".join(lines) if lines else ""


def _build_pasportizaciya(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> str:
    """Паспортизация: sample_type «Паспортизация», по НСПК, УКПГ-11В, ОУПДТ."""
    items = [s for s in samples if _sample_type_equals(s, "Паспортизация")]
    if not items:
        return ""
    loc_names_order = ("НСПК", "УКПГ-11В", "ОУПДТ")
    by_loc: dict[str, list[Sample]] = defaultdict(list)
    for s in items:
        name = (s.sampling_location.name or "").strip() if s.sampling_location else ""
        if name in loc_names_order:
            by_loc[name].append(s)
    lines = []
    for loc_name in loc_names_order:
        loc_samples = by_loc.get(loc_name, [])
        if not loc_samples:
            continue
        cnt = len(loc_samples)
        pok = sum(agg.get(s.id, (0, 0))[1] for s in loc_samples)
        if cnt == 0:
            continue
        lines.append(f"{loc_name} - {cnt} шт по {pok} пок")
    return "\n".join(lines) if lines else ""


def _build_gkp_by_location(
    samples: list[Sample],
    agg: dict[int, tuple[int, int]],
    loc_name: str,
    sample_type_filter: str = "Паспортизация",
) -> str:
    """Общая логика для ГКП-21 или ГКП-22: по дате, количество и показатели."""
    items = [
        s
        for s in samples
        if _sample_type_equals(s, sample_type_filter)
        and (
            s.sampling_location and (s.sampling_location.name or "").strip() == loc_name
        )
    ]
    if not items:
        return ""
    by_date: dict[pendulum.Date, list[Sample]] = defaultdict(list)
    for s in items:
        dt = s.receiving_date or pendulum.date(1900, 1, 1)
        by_date[dt].append(s)
    lines = [f"{loc_name} {len(items)} шт"]
    for dt in sorted(by_date.keys()):
        subs = by_date[dt]
        pok = sum(agg.get(s.id, (0, 0))[1] for s in subs)
        if pok > 0:
            lines.append(f"{_fmt_date(dt)} по {pok} пок")
    return "\n".join(lines) if lines else ""


def _build_gkp_21(samples: list[Sample], agg: dict[int, tuple[int, int]]) -> str:
    """ГКП-21: Паспортизация, по дате."""
    return _build_gkp_by_location(samples, agg, "ГКП-21", "Паспортизация")


def _build_gkp_22(samples: list[Sample], agg: dict[int, tuple[int, int]]) -> str:
    """ГКП-22: Паспортизация, по дате."""
    return _build_gkp_by_location(samples, agg, "ГКП-22", "Паспортизация")


def _build_gkp_21_gkp_22(samples: list[Sample], agg: dict[int, tuple[int, int]]) -> str:
    """ГКП-21 ГКП-22: sampling_location ГКП-21/ГКП-22, sample_type «Паспортизация», по дате."""
    items = [
        s
        for s in samples
        if _sample_type_equals(s, "Паспортизация")
        and _sampling_location_name_in(s, SAMPLING_LOCATIONS_GKP)
    ]
    if not items:
        return ""
    by_loc: dict[str, dict[pendulum.Date, list[Sample]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for s in items:
        name = (s.sampling_location.name or "").strip()
        dt = s.receiving_date or pendulum.date(1900, 1, 1)
        by_loc[name][dt].append(s)
    lines = []
    for loc_name in ("ГКП-21", "ГКП-22"):
        if loc_name not in by_loc:
            continue
        dates_dict = by_loc[loc_name]
        total = sum(len(v) for v in dates_dict.values())
        if total == 0:
            continue
        lines.append(f"{loc_name} {total} шт")
        for dt in sorted(dates_dict.keys()):
            subs = dates_dict[dt]
            pok = sum(agg.get(s.id, (0, 0))[1] for s in subs)
            if pok > 0:
                lines.append(f"{_fmt_date(dt)} по {pok} пок")
    return "\n".join(lines) if lines else ""


def _build_ois_achimovka(samples: list[Sample], agg: dict[int, tuple[int, int]]) -> str:
    """ОИС Ачимовка: sample_type «Исследования - ОИС», sampling_location ГКП-21, ГКП-22."""
    items = [
        s
        for s in samples
        if _sample_type_equals(s, "Исследования - ОИС")
        and _sampling_location_name_in(s, SAMPLING_LOCATIONS_GKP)
    ]
    if not items:
        return ""
    return _build_gkp_21_gkp_22(items, agg)


def _build_ois(samples: list[Sample], agg: dict[int, tuple[int, int]]) -> str:
    """ОИС: Исследования - ОИС, не test_object «нефть товарная», по месту с скважиной и датой."""
    items = [
        s
        for s in samples
        if _sample_type_equals(s, "Исследования - ОИС")
        and _test_object_not_equals(s, "нефть товарная")
        and s.well
    ]
    if not items:
        return ""
    by_loc: dict[str, list[Sample]] = defaultdict(list)
    for s in items:
        name = (s.sampling_location.name or "").strip() if s.sampling_location else ""
        by_loc[name].append(s)
    lines = []
    for loc_name in sorted(by_loc.keys()):
        loc_samples = by_loc[loc_name]
        cnt = len(loc_samples)
        pok = sum(agg.get(s.id, (0, 0))[1] for s in loc_samples)
        if cnt == 0 and pok == 0:
            continue
        display_name = DISPLAY_NAMES_CDGGKN.get(loc_name, loc_name)
        lines.append(f"{cnt} шт по {pok} пок")
        for s in sorted(
            loc_samples,
            key=lambda x: (x.receiving_date or pendulum.date(1900, 1, 1), x.well or ""),
        ):
            lines.append(
                f"{display_name} скв. {s.well} от {_fmt_date(s.receiving_date)}"
            )
    return "\n".join(lines) if lines else ""


def _build_tovarnaya_produkciya_ois(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> str:
    """Товарная продукция ОИС: Исследования - ОИС, test_object «нефть товарная», ГКП-21/ГКП-22 по дате."""
    items = [
        s
        for s in samples
        if _sample_type_equals(s, "Исследования - ОИС")
        and _test_object_equals(s, "нефть товарная")
        and _sampling_location_name_in(s, SAMPLING_LOCATIONS_GKP)
    ]
    if not items:
        return ""
    by_loc: dict[str, list[Sample]] = defaultdict(list)
    for s in items:
        name = (s.sampling_location.name or "").strip()
        by_loc[name].append(s)
    lines = []
    for loc_name in ("ГКП-21", "ГКП-22"):
        loc_samples = by_loc.get(loc_name, [])
        if not loc_samples:
            continue
        lines.append(f"{loc_name} {len(loc_samples)} шт")
        for s in sorted(
            loc_samples, key=lambda x: x.receiving_date or pendulum.date(1900, 1, 1)
        ):
            lines.append(_fmt_date(s.receiving_date))
    return "\n".join(lines) if lines else ""


def _build_prochie(samples: list[Sample], agg: dict[int, tuple[int, int]]) -> str:
    """Прочие: sample_type «Исследования - прочие», по sampling_location."""
    items = [s for s in samples if _sample_type_equals(s, "Исследования - прочие")]
    if not items:
        return ""
    by_loc: dict[str, int] = defaultdict(int)
    for s in items:
        name = (s.sampling_location.name or "").strip() if s.sampling_location else ""
        if name:
            by_loc[name] += 1
    total = len(items)
    lines = [f"{total} шт"]
    for loc_name in sorted(by_loc.keys(), key=lambda x: -by_loc[x]):
        lines.append(f"{loc_name} - {by_loc[loc_name]} шт")
    return "\n".join(lines) if lines else ""


def _build_diztoplivo_ingibitor(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> str:
    """Дизтопливо и Ингибитор коррозии вместе: по test_object, месту, дате отбора и показателям."""
    items = [
        s
        for s in samples
        if _test_object_ilike(s, "дизельное топливо")
        or _test_object_ilike(s, "ингибитор коррозии")
    ]
    if not items:
        return ""
    lines = []
    for test_name, search in (
        ("Дизтопливо", "дизельное топливо"),
        ("Ингибитор коррозии", "ингибитор коррозии"),
    ):
        subs = [s for s in items if search in (s.test_object or "").lower()]
        if not subs:
            continue
        lines.append(test_name)
        by_place_date: dict[tuple[str, Optional[pendulum.Date]], list[Sample]] = (
            defaultdict(list)
        )
        for s in subs:
            place = (
                (s.sampling_location.name or "").strip() if s.sampling_location else ""
            )
            dt = s.receiving_date
            by_place_date[(place, dt)].append(s)
        for (place, dt), loc_samples in sorted(
            by_place_date.items(),
            key=lambda x: (x[0][0], x[0][1] or pendulum.date(1900, 1, 1)),
        ):
            cnt = len(loc_samples)
            pok = sum(agg.get(s.id, (0, 0))[1] for s in loc_samples)
            lines.append(f"{cnt} шт {place} от {_fmt_date(dt)} по {pok} пок")
    return "\n".join(lines) if lines else ""


def _build_diztoplivo(samples: list[Sample], agg: dict[int, tuple[int, int]]) -> str:
    """Только дизтопливо: место отбора, дата, показатели."""
    items = [s for s in samples if _test_object_ilike(s, "дизельное топливо")]
    if not items:
        return ""
    lines = []
    by_place_date: dict[tuple[str, Optional[pendulum.Date]], list[Sample]] = (
        defaultdict(list)
    )
    for s in items:
        place = (s.sampling_location.name or "").strip() if s.sampling_location else ""
        by_place_date[(place, s.receiving_date)].append(s)
    for (place, dt), loc_samples in sorted(
        by_place_date.items(),
        key=lambda x: (x[0][0], x[0][1] or pendulum.date(1900, 1, 1)),
    ):
        cnt = len(loc_samples)
        pok = sum(agg.get(s.id, (0, 0))[1] for s in loc_samples)
        lines.append(f"{cnt} шт {place} от {_fmt_date(dt)} по {pok} пок")
    return "\n".join(lines) if lines else ""


def _build_ingibitor(samples: list[Sample], agg: dict[int, tuple[int, int]]) -> str:
    """Только ингибитор коррозии: место отбора, дата, показатели."""
    items = [s for s in samples if _test_object_ilike(s, "ингибитор коррозии")]
    if not items:
        return ""
    lines = []
    by_place_date: dict[tuple[str, Optional[pendulum.Date]], list[Sample]] = (
        defaultdict(list)
    )
    for s in items:
        place = (s.sampling_location.name or "").strip() if s.sampling_location else ""
        by_place_date[(place, s.receiving_date)].append(s)
    for (place, dt), loc_samples in sorted(
        by_place_date.items(),
        key=lambda x: (x[0][0], x[0][1] or pendulum.date(1900, 1, 1)),
    ):
        cnt = len(loc_samples)
        pok = sum(agg.get(s.id, (0, 0))[1] for s in loc_samples)
        lines.append(f"{cnt} шт {place} от {_fmt_date(dt)} по {pok} пок")
    return "\n".join(lines) if lines else ""


def _build_all_row_values(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> dict[str, str]:
    """Строит значение для каждой строки отчёта (ключ — заголовок строки)."""
    builders = {
        ROW_TITLE_TOVARNAYA_NEFT_NGDU: _build_tovarnaya_neft_ngdu,
        ROW_TITLE_EKSPLUATACIONNAYA_NEFT_NGDU: _build_ekspluatacionnaya_neft_ngdu,
        ROW_TITLE_KALIBROVOCHNAYA_NEFT_UGPU: _build_kalibrovochnaya_neft_ugpu,
        ROW_TITLE_PASPORTIZACIYA: _build_pasportizaciya,
        ROW_TITLE_GKP_21: _build_gkp_21,
        ROW_TITLE_GKP_22: _build_gkp_22,
        ROW_TITLE_GKP_21_GKP_22: _build_gkp_21_gkp_22,
        ROW_TITLE_OIS_ACHIMOVKA: _build_ois_achimovka,
        ROW_TITLE_OIS: _build_ois,
        ROW_TITLE_TOVARNAYA_PRODUKCIYA_OIS: _build_tovarnaya_produkciya_ois,
        ROW_TITLE_PROCHIE: _build_prochie,
        ROW_TITLE_DIZTOPIVO: _build_diztoplivo,
        ROW_TITLE_INGIBITOR_KORROZII: _build_ingibitor,
        ROW_TITLE_DIZTOPIVO_INGIBITOR: _build_diztoplivo_ingibitor,
    }
    result = {}
    for title, builder in builders.items():
        value = builder(samples, agg)
        if value:
            result[title] = value
    return result


def _split_by_branch(
    samples: list[Sample],
    agg: dict[int, tuple[int, int]],
    row_titles_for_branch: dict[str, Optional[str]],
) -> list[BranchRows]:
    """
    Разбивает отчёт по branch_id. row_titles_for_branch: заголовок строки -> branch name (None = по всем).
    """
    branches_seen: dict[int, tuple[int, str]] = {}
    for s in samples:
        if s.branch_id and s.branch:
            branches_seen[s.branch_id] = (s.branch_id, (s.branch.name or "").strip())

    result: list[BranchRows] = []
    for branch_id, branch_name in branches_seen.values():
        branch_samples = [s for s in samples if s.branch_id == branch_id]
        row_values = _build_all_row_values(branch_samples, agg)
        rows = []
        for row_title, value in row_values.items():
            expected_branch = row_titles_for_branch.get(row_title)
            if expected_branch is not None and expected_branch != branch_name:
                continue
            if value:
                rows.append({"label": row_title, "value": value})
        if rows:
            result.append(
                BranchRows(branch_id=branch_id, branch_name=branch_name, rows=rows)
            )
    return result


# Какие строки привязаны к филиалу по названию (остальные — общие по лаборатории, но мы режем по branch).
ROW_TITLE_TO_BRANCH: dict[str, Optional[str]] = {
    ROW_TITLE_TOVARNAYA_NEFT_NGDU: BRANCH_NGDU,
    ROW_TITLE_EKSPLUATACIONNAYA_NEFT_NGDU: BRANCH_NGDU,
    ROW_TITLE_KALIBROVOCHNAYA_NEFT_UGPU: BRANCH_UGPU,
    ROW_TITLE_PASPORTIZACIYA: None,
    ROW_TITLE_GKP_21: None,
    ROW_TITLE_GKP_22: None,
    ROW_TITLE_GKP_21_GKP_22: None,
    ROW_TITLE_OIS_ACHIMOVKA: None,
    ROW_TITLE_OIS: None,
    ROW_TITLE_TOVARNAYA_PRODUKCIYA_OIS: None,
    ROW_TITLE_PROCHIE: None,
    ROW_TITLE_DIZTOPIVO: None,
    ROW_TITLE_INGIBITOR_KORROZII: None,
    ROW_TITLE_DIZTOPIVO_INGIBITOR: None,
}


def _normalize_cell_a_for_match(cell_value: Any) -> str:
    """Нормализация значения ячейки A для сопоставления с ключами строк."""
    if cell_value is None:
        return ""
    s = str(cell_value).strip()
    if not s:
        return ""
    return s.replace("\n", " ").replace("\r", " ")


def match_row_title_to_value(
    cell_a_value: Any, row_values: dict[str, str]
) -> Optional[str]:
    """
    По значению ячейки A возвращает значение для столбца B из row_values.
    Сопоставление без учёта регистра и лишних пробелов/переносов.
    """
    key = _normalize_cell_a_for_match(cell_a_value)
    if not key:
        return None
    key_lower = key.lower()
    for title, value in row_values.items():
        if title.lower() == key_lower:
            return value
    return None


async def get_sample_count_report_data(
    db: AsyncSession,
    laboratory_id: int,
    receiving_date_from: Optional[pendulum.DateTime],
    receiving_date_to: Optional[pendulum.DateTime],
    department_id: Optional[int] = None,
) -> dict[str, Any]:
    """
    Возвращает данные для отчёта «Количество проб»: предварительная версия (все строки)
    и разбивка по branch_id. Пустые строки не включаются.
    """
    samples = await _get_samples_in_range(
        db,
        laboratory_id,
        receiving_date_from,
        receiving_date_to,
        department_id=department_id,
    )
    sample_ids = [s.id for s in samples]
    agg = await _get_calc_agg_by_sample(db, sample_ids)

    preliminary = _build_all_row_values(samples, agg)
    by_branch = _split_by_branch(samples, agg, ROW_TITLE_TO_BRANCH)

    return {
        "preliminary": [{"label": k, "value": v} for k, v in preliminary.items()],
        "by_branch": [
            {
                "branch_id": br.branch_id,
                "branch_name": br.branch_name,
                "rows": br.rows,
            }
            for br in by_branch
        ],
    }
