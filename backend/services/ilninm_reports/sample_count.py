"""
Отчёт «Количество проб» для лаборатории ИЛНиНМ.

Собирает по пробам за период (по дате получения) количество расчётов и показателей,
группирует по типам строк отчёта и по branch_id. Пустые строки (0 шт / 0 пок) не выводятся.
В отчёт попадают только неудалённые пробы (deleted_at IS NULL) и неудалённые расчёты.

Места отбора с префиксами «ГКП-21» и «ГКП-22» сопоставляются по началу имени.
Число в «N шт» подменяется по правилам (_map_display_sht_count).
"""

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Optional
import pendulum
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from core.logger import logger
from models.calculation import Calculation
from models.laboratory import Branch, SamplingLocation
from models.sample import Sample
from utils.filters import add_date_range_filter
from .constants import (
    BRANCH_GPU_PRAO,
    BRANCH_NGDU,
    BRANCH_UGPU,
    DISPLAY_NAMES_CDGGKN,
    GKP_SAMPLING_NAME_PREFIX_21,
    GKP_SAMPLING_NAME_PREFIX_22,
    LABORATORY_NAME_ILNINM,
    ROW_TITLE_DIZTOPIVO_INGIBITOR,
    ROW_TITLE_EKSPLUATACIONNAYA_NEFT_NGDU,
    ROW_TITLE_GKP_21_GKP_22,
    ROW_TITLE_KALIBROVOCHNAYA_NEFT_UGPU,
    ROW_TITLE_NEFTECONDENSATNAYA_SMES,
    ROW_TITLE_OIS,
    ROW_TITLE_OIS_ACHIMOVKA,
    ROW_TITLE_OIS_EN_YAHA,
    ROW_TITLE_OIS_VALANZHIN,
    ROW_TITLE_PASPORTIZACIYA,
    ROW_TITLE_PROCHIE,
    ROW_TITLE_TOVARNAYA_NEFT_NGDU,
    ROW_TITLE_TOVARNAYA_PRODUKCIYA_OIS,
    ROW_TITLE_VNEPLANOVAYA_NEFT,
    SAMPLE_TYPE_VNEPLANOVYE,
    SAMPLING_LOCATION_UKPG_11V,
    SAMPLING_LOCATIONS_CDGGKN,
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


def _test_object_ilike(s: Sample, part: str) -> bool:
    return part.lower() in (s.test_object or "").lower()


def _sampling_location_name_in(s: Sample, names: tuple[str, ...]) -> bool:
    if not s.sampling_location:
        return False
    return (s.sampling_location.name or "").strip() in names


def _branch_name_equals(s: Sample, name: str) -> bool:
    if not s.branch:
        return False
    return (s.branch.name or "").strip() == name


def _is_vneplanovaya_neft_sample(s: Sample) -> bool:
    """Внеплановая нефть: тип «Внеплановые», объект с «нефть», без калибровочной."""
    return (
        _sample_type_equals(s, SAMPLE_TYPE_VNEPLANOVYE)
        and _test_object_ilike(s, "нефть")
        and not _test_object_ilike(s, "нефть калибровочная")
    )


def _sampling_location_display_name(s: Sample) -> str:
    """Имя места отбора для отчёта: краткие подписи для цехов ДГГКН, иначе как в справочнике."""
    raw = (s.sampling_location.name or "").strip() if s.sampling_location else ""
    if not raw:
        return "(место отбора не указано)"
    return DISPLAY_NAMES_CDGGKN.get(raw, raw)


def _sample_type_equals(s: Sample, value: str) -> bool:
    return (s.sample_type or "").strip() == value


def _well_contains_tovarnaya_produkciya(s: Sample) -> bool:
    return "товарная продукция" in (s.well or "").lower()


def _map_display_sht_count(n: int) -> int:
    """Число для вывода в «N шт»: 1→2, 4→5, 6–8→9, 10–12→13, остальное без изменений."""
    if n == 1:
        return 2
    if n == 4:
        return 5
    if n in (6, 7, 8):
        return 9
    if n in (10, 11, 12):
        return 13
    return n


def _sample_labels_for_log(samples: list[Sample]) -> str:
    """Регистрационные номера проб для лога."""
    parts: list[str] = []
    for s in sorted(samples, key=lambda x: ((x.registration_number or ""), x.id)):
        n = (s.registration_number or "").strip()
        parts.append(n if n else f"id={s.id}")
    return ", ".join(parts)


def _sampling_location_name_starts_with(s: Sample, prefix: str) -> bool:
    if not s.sampling_location:
        return False
    return (s.sampling_location.name or "").strip().startswith(prefix)


def _is_gkp_21_or_22_location(s: Sample) -> bool:
    return _sampling_location_name_starts_with(
        s, GKP_SAMPLING_NAME_PREFIX_21
    ) or _sampling_location_name_starts_with(s, GKP_SAMPLING_NAME_PREFIX_22)


def _is_ukpg_11v_location(s: Sample) -> bool:
    return _sampling_location_name_starts_with(s, SAMPLING_LOCATION_UKPG_11V)


def _sort_samples_for_gkp_report(samples: list[Sample]) -> list[Sample]:
    """Порядок строк ГКП: дата получения, рег. номер, id."""
    return sorted(
        samples,
        key=lambda s: (
            s.receiving_date or pendulum.date(1900, 1, 1),
            (s.registration_number or "").strip(),
            s.id,
        ),
    )


def _gkp_sample_line(
    s: Sample,
    agg: dict[int, tuple[int, int]],
    *,
    ois_sht_suffix: bool,
) -> str:
    """Одна проба ГКП: место отбора, скв./режим при наличии, рег. номер, дата получения, показатели."""
    name = (s.sampling_location.name or "").strip() if s.sampling_location else ""
    text = name if name else "(место отбора не указано)"
    well_key = (s.well or "").strip()
    mode_key = (s.mode or "").strip()
    if well_key:
        text += f" скв. {well_key}"
    if mode_key:
        text += f" {mode_key}"
    reg = (s.registration_number or "").strip()
    dt = s.receiving_date
    date_part = _fmt_date(dt) if dt else "(дата получения не указана)"
    pok = agg.get(s.id, (0, 0))[1]
    if ois_sht_suffix:
        text += f" от {date_part} по {pok} пок {_map_display_sht_count(1)} шт"
    else:
        text += f" от {date_part} по {pok} пок"
    return text


def _build_tovarnaya_neft_ngdu(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """Товарная нефть НГДУ: объект «нефть», без калибровочной, филиал НГДУ, без скважины."""
    items = [
        s
        for s in samples
        if _branch_name_equals(s, BRANCH_NGDU)
        and _test_object_ilike(s, "нефть")
        and not _test_object_ilike(s, "нефть калибровочная")
        and not (s.well or "").strip()
        and not _is_vneplanovaya_neft_sample(s)
    ]
    if not items:
        return "", []
    total_cnt = sum(agg.get(s.id, (0, 0))[0] for s in items)
    if total_cnt == 0:
        return "", items
    all_pok = set()
    for s in items:
        _, pok = agg.get(s.id, (0, 0))
        if pok > 0:
            all_pok.add((s.id, pok))
    pok_count = sum(p for _, p in all_pok) if all_pok else 0
    if pok_count == 0:
        pok_count = sum(agg.get(s.id, (0, 0))[1] for s in items)
    d = _map_display_sht_count(len(items))
    return f"{d} шт по {pok_count} пок", items


def _build_ekspluatacionnaya_neft_ngdu(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """Эксплуатационная нефть НГДУ: цехи ДГГКН №1/№2, «нефть», не калибровочная; скважина обязательна."""
    items = [
        s
        for s in samples
        if _branch_name_equals(s, BRANCH_NGDU)
        and _test_object_ilike(s, "нефть")
        and not _test_object_ilike(s, "нефть калибровочная")
        and _sampling_location_name_in(s, SAMPLING_LOCATIONS_CDGGKN)
        and (s.well or "").strip()
        and not _is_vneplanovaya_neft_sample(s)
    ]
    if not items:
        return "", []
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
        lines.append(f"{_map_display_sht_count(cnt)} шт по {pok} пок")
        for s in sorted(
            loc_samples,
            key=lambda x: (x.receiving_date or pendulum.date(1900, 1, 1), x.well or ""),
        ):
            if (s.well or "").strip():
                lines.append(
                    f"{display_name} скв. {s.well} от {_fmt_date(s.receiving_date)}"
                )
    return ("\n".join(lines) if lines else ""), items


def _build_kalibrovochnaya_neft_ugpu(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """Калибровочная нефть УГПУ: объект «нефть калибровочная», цехи ДГГКН №1/№2, филиал УГПУ."""
    items = [
        s
        for s in samples
        if _branch_name_equals(s, BRANCH_UGPU)
        and _test_object_ilike(s, "нефть калибровочная")
        and _sampling_location_name_in(s, SAMPLING_LOCATIONS_CDGGKN)
    ]
    if not items:
        return "", []
    by_loc: dict[str, int] = defaultdict(int)
    for s in items:
        name = (s.sampling_location.name or "").strip()
        by_loc[name] += 1
    parts = [
        f"{_map_display_sht_count(c)} шт"
        for loc_name in ("Цех по ДГГКН №2", "Цех по ДГГКН №1")
        for c in [by_loc.get(loc_name, 0)]
        if c > 0
    ]
    if not parts:
        return "", items
    lines = [f"{_map_display_sht_count(sum(by_loc.values()))} шт"]
    for loc_name in ("Цех по ДГГКН №2", "Цех по ДГГКН №1"):
        if by_loc.get(loc_name, 0) > 0:
            lines.append(DISPLAY_NAMES_CDGGKN.get(loc_name, loc_name))
    return ("\n".join(lines) if lines else ""), items


def _build_vneplanovaya_neft(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """
    Внеплановая нефть по филиалу: тип «Внеплановые», объект «нефть» (не калибровочная).

    Строки: место отбора; при наличии через пробел — скважина и режим; сумма показателей в «по N пок».
    """
    items = [s for s in samples if _is_vneplanovaya_neft_sample(s)]
    if not items:
        return "", []
    by_key: dict[tuple[str, str, str], list[Sample]] = defaultdict(list)
    for s in items:
        place = _sampling_location_display_name(s)
        well_key = (s.well or "").strip()
        mode_key = (s.mode or "").strip()
        by_key[(place, well_key, mode_key)].append(s)
    lines: list[str] = []
    for key in sorted(by_key.keys(), key=lambda x: (x[0], x[1], x[2])):
        group = by_key[key]
        place, well_key, mode_key = key
        pok = sum(agg.get(s.id, (0, 0))[1] for s in group)
        text = place
        if well_key:
            text += f" скв. {well_key}"
        if mode_key:
            text += f" {mode_key}"
        lines.append(f"{text} по {pok} пок")
    return "\n".join(lines), items


def _build_pasportizaciya(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """
    Паспортизация: пробы с типом «Паспортизация».

    Учитываются только фиксированные места отбора в порядке вывода: НСПК, УКПГ-11В, ОУПДТ.
    По каждому месту — число проб (с подменой по _map_display_sht_count) и сумма показателей
    по расчётам. Пробы с другими местами отбора в эту строку не попадают (остаются вне среза).
    """
    items = [s for s in samples if _sample_type_equals(s, "Паспортизация")]
    if not items:
        return "", []
    loc_names_order = ("НСПК", "УКПГ-11В", "ОУПДТ")
    by_loc: dict[str, list[Sample]] = defaultdict(list)
    for s in items:
        name = (s.sampling_location.name or "").strip() if s.sampling_location else ""
        if name in loc_names_order:
            by_loc[name].append(s)
    used: list[Sample] = []
    lines = []
    for loc_name in loc_names_order:
        loc_samples = by_loc.get(loc_name, [])
        if not loc_samples:
            continue
        cnt = len(loc_samples)
        pok = sum(agg.get(s.id, (0, 0))[1] for s in loc_samples)
        if cnt == 0:
            continue
        used.extend(loc_samples)
        lines.append(f"{loc_name} - {_map_display_sht_count(cnt)} шт по {pok} пок")
    return ("\n".join(lines) if lines else ""), used


def _build_gkp_21_gkp_22(
    samples: list[Sample],
    agg: dict[int, tuple[int, int]],
    sample_type: str = "Паспортизация",
) -> tuple[str, list[Sample]]:
    """По каждому ГКП: заголовок с количеством в одной строке, затем строки по пробам."""
    items = [
        s
        for s in samples
        if _sample_type_equals(s, sample_type) and _is_gkp_21_or_22_location(s)
    ]
    if not items:
        return "", []
    gkp22 = [
        s
        for s in items
        if _sampling_location_name_starts_with(s, GKP_SAMPLING_NAME_PREFIX_22)
    ]
    in_gkp22 = {id(s) for s in gkp22}
    gkp21 = [
        s
        for s in items
        if _sampling_location_name_starts_with(s, GKP_SAMPLING_NAME_PREFIX_21)
        and id(s) not in in_gkp22
    ]

    def _passport_sample_lines(subset: list[Sample]) -> list[str]:
        return [
            _gkp_sample_line(s, agg, ois_sht_suffix=False)
            for s in _sort_samples_for_gkp_report(subset)
        ]

    lines: list[str] = [
        f"{GKP_SAMPLING_NAME_PREFIX_21} {_map_display_sht_count(len(gkp21))} шт",
        *_passport_sample_lines(gkp21),
        "",
        f"{GKP_SAMPLING_NAME_PREFIX_22} {_map_display_sht_count(len(gkp22))} шт",
        *_passport_sample_lines(gkp22),
    ]
    return "\n".join(lines), items


def _build_ois_achimovka(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """
    ОИС Ачимовка: тип «Исследования - ОИС», место отбора с префиксом ГКП-21 или ГКП-22.

    По каждому префиксу: заголовок с «N шт» в одной строке, затем строка на каждую пробу.
    """
    items = [
        s
        for s in samples
        if _sample_type_equals(s, "Исследования - ОИС")
        and _is_gkp_21_or_22_location(s)
        and not _well_contains_tovarnaya_produkciya(s)
    ]
    if not items:
        return "", []
    gkp22 = [
        s
        for s in items
        if _sampling_location_name_starts_with(s, GKP_SAMPLING_NAME_PREFIX_22)
    ]
    in_gkp22 = {id(s) for s in gkp22}
    gkp21 = [
        s
        for s in items
        if _sampling_location_name_starts_with(s, GKP_SAMPLING_NAME_PREFIX_21)
        and id(s) not in in_gkp22
    ]

    def _ois_sample_lines(subset: list[Sample]) -> list[str]:
        return [
            _gkp_sample_line(s, agg, ois_sht_suffix=True)
            for s in _sort_samples_for_gkp_report(subset)
        ]

    lines: list[str] = [
        f"{GKP_SAMPLING_NAME_PREFIX_21} {_map_display_sht_count(len(gkp21))} шт",
        *_ois_sample_lines(gkp21),
        "",
        f"{GKP_SAMPLING_NAME_PREFIX_22} {_map_display_sht_count(len(gkp22))} шт",
        *_ois_sample_lines(gkp22),
    ]
    return "\n".join(lines), items


def _build_ois_valanzhin(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """ОИС Валанжин: «Исследования - ОИС», без ГКП-21/22 и без префикса УКПГ-11В."""
    items = [
        s
        for s in samples
        if _sample_type_equals(s, "Исследования - ОИС")
        and not _is_gkp_21_or_22_location(s)
        and not _is_ukpg_11v_location(s)
        and not _well_contains_tovarnaya_produkciya(s)
    ]
    if not items:
        return "", []
    by_loc: dict[str, list[Sample]] = defaultdict(list)
    for s in items:
        name = (s.sampling_location.name or "").strip() if s.sampling_location else ""
        key = name if name else "(место отбора не указано)"
        by_loc[key].append(s)
    lines: list[str] = []
    for loc_name in sorted(by_loc.keys()):
        loc_samples = by_loc[loc_name]
        pok = sum(agg.get(s.id, (0, 0))[1] for s in loc_samples)
        lines.append(
            f"{_map_display_sht_count(len(loc_samples))} шт {loc_name} по {pok} пок"
        )
    return "\n\n".join(lines), items


def _build_ois_en_yaha(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """ОИС Ен-Яха: «Исследования - ОИС», место отбора с префиксом УКПГ-11В."""
    items = [
        s
        for s in samples
        if _sample_type_equals(s, "Исследования - ОИС")
        and _is_ukpg_11v_location(s)
        and not _well_contains_tovarnaya_produkciya(s)
    ]
    if not items:
        return "", []
    by_loc: dict[str, list[Sample]] = defaultdict(list)
    for s in items:
        name = (s.sampling_location.name or "").strip() if s.sampling_location else ""
        key = name if name else "(место отбора не указано)"
        by_loc[key].append(s)
    lines = [f"{_map_display_sht_count(len(items))} шт"]
    for loc_name in sorted(by_loc.keys()):
        loc_samples = by_loc[loc_name]
        pok = sum(agg.get(s.id, (0, 0))[1] for s in loc_samples)
        lines.append(f"{loc_name} по {pok} пок")
    return "\n".join(lines), items


def _build_ois(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """ОИС: «Исследования - ОИС», цехи ДГГКН №1/№2, филиалы НГДУ/УГПУ/ГПУпРАО, скважина обязательна."""
    allowed_branches = (BRANCH_NGDU, BRANCH_UGPU, BRANCH_GPU_PRAO)
    items = [
        s
        for s in samples
        if _sample_type_equals(s, "Исследования - ОИС")
        and _sampling_location_name_in(s, SAMPLING_LOCATIONS_CDGGKN)
        and any(_branch_name_equals(s, branch_name) for branch_name in allowed_branches)
        and (s.well or "").strip()
        and not _well_contains_tovarnaya_produkciya(s)
    ]
    if not items:
        return "", []
    by_loc: dict[str, list[Sample]] = defaultdict(list)
    for s in items:
        name = (s.sampling_location.name or "").strip() if s.sampling_location else ""
        by_loc[name].append(s)
    lines: list[str] = []
    for loc_name in SAMPLING_LOCATIONS_CDGGKN:
        loc_samples = by_loc.get(loc_name, [])
        if not loc_samples:
            continue
        pok = sum(agg.get(s.id, (0, 0))[1] for s in loc_samples)
        lines.append(f"{_map_display_sht_count(len(loc_samples))} шт по {pok} пок")
        display_name = DISPLAY_NAMES_CDGGKN.get(loc_name, loc_name)
        for s in sorted(
            loc_samples,
            key=lambda x: (
                x.receiving_date or pendulum.date(1900, 1, 1),
                (x.well or "").strip(),
                x.id,
            ),
        ):
            well_key = (s.well or "").strip()
            date_part = (
                _fmt_date(s.receiving_date)
                if s.receiving_date
                else "(дата получения не указана)"
            )
            lines.append(f"{display_name} скв. {well_key} от {date_part}")
        lines.append("")
    if lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines), items


def _build_tovarnaya_produkciya_ois(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """Товарная продукция ОИС: ОИС по ГКП-21/22, в скважине есть «товарная продукция», вывод — даты."""
    del agg
    allowed_branches = (BRANCH_NGDU, BRANCH_UGPU, BRANCH_GPU_PRAO)
    items = [
        s
        for s in samples
        if _sample_type_equals(s, "Исследования - ОИС")
        and _is_gkp_21_or_22_location(s)
        and any(_branch_name_equals(s, branch_name) for branch_name in allowed_branches)
        and "товарная продукция" in (s.well or "").lower()
    ]
    if not items:
        return "", []
    gkp21 = [
        s
        for s in items
        if _sampling_location_name_starts_with(s, GKP_SAMPLING_NAME_PREFIX_21)
    ]
    gkp22 = [
        s
        for s in items
        if _sampling_location_name_starts_with(s, GKP_SAMPLING_NAME_PREFIX_22)
    ]
    lines: list[str] = []
    for title, subset in (
        (GKP_SAMPLING_NAME_PREFIX_21, gkp21),
        (GKP_SAMPLING_NAME_PREFIX_22, gkp22),
    ):
        if not subset:
            continue
        lines.append(title)
        for s in sorted(
            subset, key=lambda x: (x.receiving_date or pendulum.date(1900, 1, 1), x.id)
        ):
            lines.append(
                _fmt_date(s.receiving_date)
                if s.receiving_date
                else "(дата получения не указана)"
            )
    return "\n".join(lines), items


def _build_neftecondensatnaya_smes(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """Нефтеконденсатная смесь: объект испытаний «нефтеконденсатная смесь», сводка по местам отбора."""
    items = [s for s in samples if _test_object_ilike(s, "нефтеконденсатная смесь")]
    if not items:
        return "", []
    by_loc: dict[str, int] = defaultdict(int)
    for s in items:
        name = (s.sampling_location.name or "").strip() if s.sampling_location else ""
        key = name if name else "(место отбора не указано)"
        by_loc[key] += 1
    lines = [f"{_map_display_sht_count(len(items))} шт"]
    for loc_name in sorted(by_loc.keys()):
        lines.append(f"{loc_name} - {_map_display_sht_count(by_loc[loc_name])} шт")
    return "\n".join(lines), items


def _build_prochie(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """Прочие: место отбора (+ скважина/режим), дата отбора и сумма показателей."""
    items = [
        s
        for s in samples
        if _sample_type_equals(s, "Исследования - прочие")
        and not _test_object_ilike(s, "дизельное топливо")
        and not _test_object_ilike(s, "ингибитор коррозии")
        and not _test_object_ilike(s, "нефтеконденсатная смесь")
    ]
    if not items:
        return "", []
    by_key: dict[tuple[str, str, str, Optional[pendulum.Date]], list[Sample]] = (
        defaultdict(list)
    )
    for s in items:
        place = (s.sampling_location.name or "").strip() if s.sampling_location else ""
        place_key = place if place else "(место отбора не указано)"
        well_key = (s.well or "").strip()
        mode_key = (s.mode or "").strip()
        dt_key = s.sampling_date or s.receiving_date
        by_key[(place_key, well_key, mode_key, dt_key)].append(s)
    total = len(items)
    lines = [f"{_map_display_sht_count(total)} шт"]
    for key in sorted(
        by_key.keys(),
        key=lambda x: (
            x[0],
            x[1],
            x[2],
            x[3] or pendulum.date(1900, 1, 1),
        ),
    ):
        place_key, well_key, mode_key, dt_key = key
        group = by_key[key]
        pok = sum(agg.get(s.id, (0, 0))[1] for s in group)
        date_part = _fmt_date(dt_key) if dt_key else "(дата отбора не указана)"

        text = place_key
        if well_key:
            text += f" скв. {well_key}"
        if mode_key:
            text += f" {mode_key}"
        lines.append(f"{text} от {date_part} по {pok} пок")
    return "\n".join(lines), items


def _build_diztoplivo_ingibitor(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """Дизтопливо и ингибитор: отдельные блоки по объекту, затем как сейчас — шт/место/дата/пок."""
    items = [
        s
        for s in samples
        if _test_object_ilike(s, "дизельное топливо")
        or _test_object_ilike(s, "ингибитор коррозии")
    ]
    if not items:
        return "", []
    groups: list[tuple[str, str]] = [
        ("Дизтопливо", "дизельное топливо"),
        ("Ингибитор коррозии", "ингибитор коррозии"),
    ]
    sections: list[str] = []
    for title, object_key in groups:
        object_samples = [s for s in items if _test_object_ilike(s, object_key)]
        if not object_samples:
            continue
        by_place_date: dict[tuple[str, Optional[pendulum.Date]], list[Sample]] = (
            defaultdict(list)
        )
        for s in object_samples:
            place = (
                (s.sampling_location.name or "").strip() if s.sampling_location else ""
            )
            by_place_date[(place, s.receiving_date)].append(s)
        section_lines: list[str] = [title]
        for (place, dt), loc_samples in sorted(
            by_place_date.items(),
            key=lambda x: (x[0][0], x[0][1] or pendulum.date(1900, 1, 1)),
        ):
            cnt = len(loc_samples)
            pok = sum(agg.get(s.id, (0, 0))[1] for s in loc_samples)
            section_lines.append(
                f"{_map_display_sht_count(cnt)} шт {place} от {_fmt_date(dt)} по {pok} пок"
            )
        sections.append("\n".join(section_lines))
    return ("\n\n".join(sections) if sections else ""), items


def _build_all_row_values(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> dict[str, str]:
    """Строит значение для каждой строки отчёта (ключ — заголовок строки)."""
    builders = {
        ROW_TITLE_TOVARNAYA_NEFT_NGDU: _build_tovarnaya_neft_ngdu,
        ROW_TITLE_EKSPLUATACIONNAYA_NEFT_NGDU: _build_ekspluatacionnaya_neft_ngdu,
        ROW_TITLE_KALIBROVOCHNAYA_NEFT_UGPU: _build_kalibrovochnaya_neft_ugpu,
        ROW_TITLE_VNEPLANOVAYA_NEFT: _build_vneplanovaya_neft,
        ROW_TITLE_PASPORTIZACIYA: _build_pasportizaciya,
        ROW_TITLE_GKP_21_GKP_22: _build_gkp_21_gkp_22,
        ROW_TITLE_OIS: _build_ois,
        ROW_TITLE_TOVARNAYA_PRODUKCIYA_OIS: _build_tovarnaya_produkciya_ois,
        ROW_TITLE_OIS_ACHIMOVKA: _build_ois_achimovka,
        ROW_TITLE_OIS_VALANZHIN: _build_ois_valanzhin,
        ROW_TITLE_OIS_EN_YAHA: _build_ois_en_yaha,
        ROW_TITLE_PROCHIE: _build_prochie,
        ROW_TITLE_NEFTECONDENSATNAYA_SMES: _build_neftecondensatnaya_smes,
        ROW_TITLE_DIZTOPIVO_INGIBITOR: _build_diztoplivo_ingibitor,
    }
    result: dict[str, str] = {}
    for title, builder in builders.items():
        value, used = builder(samples, agg)
        if value:
            result[title] = value
            if used:
                logger.info(
                    "{} - пробы: {}",
                    title,
                    _sample_labels_for_log(used),
                )
    return result


def _sample_debug_label(s: Sample) -> str:
    reg = (s.registration_number or "").strip() or "-"
    place = (s.sampling_location.name or "").strip() if s.sampling_location else "-"
    well = (s.well or "").strip() or "-"
    dt = _fmt_date(s.receiving_date) if s.receiving_date else "-"
    test_object = (s.test_object or "").strip() or "-"
    sample_type = (s.sample_type or "").strip() or "-"
    return (
        f"рег. номер={reg}; "
        f"тип пробы={sample_type}; "
        f"объект испытания={test_object}; "
        f"место отбора={place}; "
        f"скважина={well}; "
        f"дата получения={dt}"
    )


def _build_sample_count_diagnostics_text(
    samples: list[Sample],
    agg: dict[int, tuple[int, int]],
    row_titles_for_branch: dict[str, Optional[str]],
) -> str:
    """Формирует TXT-диагностику по попаданию проб в строки отчёта."""
    lines: list[str] = []
    all_total = len(samples)
    lines.append("Диагностика формирования отчёта «Количество проб»")
    lines.append(f"Всего проб за период по дате получения: {all_total}")
    lines.append("")

    included_global: set[int] = set()

    branches_seen: dict[int, tuple[int, str]] = {}
    for s in samples:
        if s.branch_id and s.branch:
            branches_seen[s.branch_id] = (s.branch_id, (s.branch.name or "").strip())

    builders = {
        ROW_TITLE_TOVARNAYA_NEFT_NGDU: _build_tovarnaya_neft_ngdu,
        ROW_TITLE_EKSPLUATACIONNAYA_NEFT_NGDU: _build_ekspluatacionnaya_neft_ngdu,
        ROW_TITLE_KALIBROVOCHNAYA_NEFT_UGPU: _build_kalibrovochnaya_neft_ugpu,
        ROW_TITLE_VNEPLANOVAYA_NEFT: _build_vneplanovaya_neft,
        ROW_TITLE_PASPORTIZACIYA: _build_pasportizaciya,
        ROW_TITLE_GKP_21_GKP_22: _build_gkp_21_gkp_22,
        ROW_TITLE_OIS: _build_ois,
        ROW_TITLE_TOVARNAYA_PRODUKCIYA_OIS: _build_tovarnaya_produkciya_ois,
        ROW_TITLE_OIS_ACHIMOVKA: _build_ois_achimovka,
        ROW_TITLE_OIS_VALANZHIN: _build_ois_valanzhin,
        ROW_TITLE_OIS_EN_YAHA: _build_ois_en_yaha,
        ROW_TITLE_PROCHIE: _build_prochie,
        ROW_TITLE_NEFTECONDENSATNAYA_SMES: _build_neftecondensatnaya_smes,
        ROW_TITLE_DIZTOPIVO_INGIBITOR: _build_diztoplivo_ingibitor,
    }

    for _, branch_name in branches_seen.values():
        branch_samples = [
            s
            for s in samples
            if s.branch and (s.branch.name or "").strip() == branch_name
        ]
        lines.append(f"=== Филиал: {branch_name} ===")
        lines.append(f"Всего проб филиала за период: {len(branch_samples)}")
        branch_included: set[int] = set()
        usage_by_sample: dict[int, set[str]] = defaultdict(set)

        for row_title, builder in builders.items():
            expected_branch = row_titles_for_branch.get(row_title)
            if expected_branch is not None and expected_branch != branch_name:
                continue
            value, used = builder(branch_samples, agg)
            if not value or not used:
                continue
            lines.append(f"- {row_title}: {len(used)} проб")
            for s in sorted(
                used,
                key=lambda x: (x.receiving_date or pendulum.date(1900, 1, 1), x.id),
            ):
                lines.append(f"  - {_sample_debug_label(s)}")
                branch_included.add(s.id)
                included_global.add(s.id)
                usage_by_sample[s.id].add(row_title)

        lines.append(f"Попало в отчёт проб: {len(branch_included)}")
        not_included = [s for s in branch_samples if s.id not in branch_included]
        lines.append(f"Не попало в отчёт: {len(not_included)}")
        for s in sorted(
            not_included,
            key=lambda x: (x.receiving_date or pendulum.date(1900, 1, 1), x.id),
        ):
            lines.append(f"  - {_sample_debug_label(s)}")

        repeated_rows = {
            sid: rows for sid, rows in usage_by_sample.items() if len(rows) > 1
        }
        lines.append(f"Повторяются в нескольких строках отчёта: {len(repeated_rows)}")
        for sid in sorted(repeated_rows.keys()):
            sample = next((s for s in branch_samples if s.id == sid), None)
            if not sample:
                continue
            joined_rows = ", ".join(sorted(repeated_rows[sid]))
            lines.append(f"  - {_sample_debug_label(sample)}; rows={joined_rows}")
        lines.append("")

    lines.append("=== Итог по периоду ===")
    lines.append(f"Всего проб за период: {all_total}")
    lines.append(f"Попало в отчёт: {len(included_global)}")
    not_included_global = [s for s in samples if s.id not in included_global]
    lines.append(f"Не попало в отчёт: {len(not_included_global)}")
    for s in sorted(
        not_included_global,
        key=lambda x: (x.receiving_date or pendulum.date(1900, 1, 1), x.id),
    ):
        lines.append(f"- {_sample_debug_label(s)}")
    return "\n".join(lines)


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
    ROW_TITLE_VNEPLANOVAYA_NEFT: None,
    ROW_TITLE_PASPORTIZACIYA: None,
    ROW_TITLE_GKP_21_GKP_22: None,
    ROW_TITLE_OIS: None,
    ROW_TITLE_TOVARNAYA_PRODUKCIYA_OIS: None,
    ROW_TITLE_OIS_ACHIMOVKA: None,
    ROW_TITLE_OIS_VALANZHIN: None,
    ROW_TITLE_OIS_EN_YAHA: None,
    ROW_TITLE_PROCHIE: None,
    ROW_TITLE_NEFTECONDENSATNAYA_SMES: None,
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
        "diagnostics_txt": _build_sample_count_diagnostics_text(
            samples, agg, ROW_TITLE_TO_BRANCH
        ),
    }
