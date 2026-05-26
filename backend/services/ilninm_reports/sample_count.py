"""
Отчёт «Количество проб» для лаборатории ИЛНиНМ.

Собирает по пробам за период (по дате получения) количество расчётов и показателей,
группирует по типам строк отчёта и по branch_id. Пустые строки (0 шт / 0 пок) не выводятся.
В отчёт попадают только неудалённые пробы (deleted_at IS NULL) и неудалённые расчёты.

Места отбора с префиксами «ГКП-21» и «ГКП-22» сопоставляются по началу имени.
Число в «N пок» подменяется по правилам (_map_display_pok_count).
«При 20 °C» и «При 50 °C» на одной пробе считаются одним показателем.
"""

import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Optional
import pendulum
from sqlalchemy import select
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
    METHOD_VISCOSITY_20,
    METHOD_VISCOSITY_50,
    ROW_TITLE_DIZTOPIVO,
    ROW_TITLE_EKSPLUATACIONNAYA_NEFT_NGDU,
    ROW_TITLE_GKP_21_GKP_22,
    ROW_TITLE_INGIBITOR,
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
    ROW_TITLE_VNEPLANOVYE,
    SAMPLE_TYPE_VNEPLANOVYE,
    SAMPLING_LOCATION_PREFIXES_VALANZHIN_UKPG,
    SAMPLING_LOCATION_UKPG_11V,
    SAMPLING_LOCATIONS_CDGGKN,
    TOVARNAYA_PRODUKCIYA_OIS_SAMPLING_PREFIXES,
)

# УКПГ-1АВ, УКПГ-1В, УКПГ-2В, УКПГ-5В, УКПГ-8В в названии места отбора: с начала или после пробела/запятой,
# затем снова пробел, запятая или конец строки — чтобы сработало к примеру на «УКПГ-2В НСПК УУКГН», и вхождение в длинную строку.
_VALANZHIN_UKPG_RE = tuple(
    re.compile(rf"(?:^|[\s,;]){re.escape(p)}(?=[\s,;]|$)")
    for p in SAMPLING_LOCATION_PREFIXES_VALANZHIN_UKPG
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


VISCOSITY_PAIR_INDICATOR_KEY = "viscosity_20_50"


def _normalize_method_name(value: Optional[str]) -> str:
    if not value:
        return ""
    text = value.strip().lower()
    return text.replace("℃", "°c")


def _is_viscosity_temperature_method(method_name: Optional[str]) -> bool:
    norm = _normalize_method_name(method_name)
    return norm in (
        _normalize_method_name(METHOD_VISCOSITY_20),
        _normalize_method_name(METHOD_VISCOSITY_50),
    )


def _indicator_key_for_calculation(calc: Calculation) -> str:
    method = calc.research_method
    method_id = method.id if method is not None else calc.research_method_id
    method_name = method.name if method is not None else None
    if _is_viscosity_temperature_method(method_name):
        return VISCOSITY_PAIR_INDICATOR_KEY
    return f"method:{method_id}"


def _count_pok_for_calculations(calculations: list[Calculation]) -> int:
    """Число показателей по пробе: вязкость при 20 и 50 °C вместе — один показатель."""
    if not calculations:
        return 0
    return len({_indicator_key_for_calculation(c) for c in calculations})


async def _get_calc_agg_by_sample(
    db: AsyncSession, sample_ids: list[int]
) -> dict[int, tuple[int, int]]:
    """По каждому sample_id: (число расчётов, число показателей с учётом вязкости 20/50)."""
    if not sample_ids:
        return {}
    query = (
        select(Calculation)
        .where(
            Calculation.sample_id.in_(sample_ids),
            Calculation.deleted_at.is_(None),
        )
        .options(selectinload(Calculation.research_method))
    )
    result = await db.execute(query)
    by_sample: dict[int, list[Calculation]] = defaultdict(list)
    for calc in result.scalars().unique().all():
        by_sample[calc.sample_id].append(calc)
    return {
        sample_id: (len(calcs), _count_pok_for_calculations(calcs))
        for sample_id, calcs in by_sample.items()
    }


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


def _is_vneplanovye_sample(s: Sample) -> bool:
    """Внеплановые: тип пробы «Внеплановые», без ограничения по объекту испытаний."""
    return _sample_type_equals(s, SAMPLE_TYPE_VNEPLANOVYE)


def _matches_tovarnaya_neft_ngdu_criteria(s: Sample) -> bool:
    """Те же критерии отбора, что для строки «Товарная нефть НГДУ»."""
    return (
        _branch_name_equals(s, BRANCH_NGDU)
        and _test_object_ilike(s, "нефть")
        and not _test_object_ilike(s, "нефть калибровочная")
        and not (s.well or "").strip()
        and not _is_vneplanovye_sample(s)
    )


def _matches_ekspluatacionnaya_neft_ngdu_criteria(s: Sample) -> bool:
    """Те же критерии отбора, что для строки «Эксплуатационная нефть НГДУ»."""
    return (
        _branch_name_equals(s, BRANCH_NGDU)
        and _test_object_ilike(s, "нефть")
        and not _test_object_ilike(s, "нефть калибровочная")
        and _sampling_location_name_in(s, SAMPLING_LOCATIONS_CDGGKN)
        and (s.well or "").strip()
        and not _is_vneplanovye_sample(s)
    )


def _sampling_location_display_name(s: Sample) -> str:
    """Имя места отбора для отчёта: краткие подписи для цехов ДГГКН, иначе как в справочнике."""
    raw = (s.sampling_location.name or "").strip() if s.sampling_location else ""
    if not raw:
        return "(место отбора не указано)"
    return DISPLAY_NAMES_CDGGKN.get(raw, raw)


def _sample_type_equals(s: Sample, value: str) -> bool:
    return (s.sample_type or "").strip() == value


def _sample_indicates_tovarnaya_produkciya(s: Sample) -> bool:
    """
    Признак товарной продукции: подстрока «товарная продукция» в режиме.

    Скважина учитывается для совместимости со старыми записями, где признак могли указать там.
    """
    mode = (s.mode or "").lower()
    well = (s.well or "").lower()
    return "товарная продукция" in mode or "товарная продукция" in well


def _map_display_pok_count(n: int) -> int:
    """Число для вывода в «N пок»: 1→2, 4→5, 6–8→9, 10–12→13, остальное без изменений."""
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


def _is_tovarnaya_produkciya_ois_location(s: Sample) -> bool:
    """Место отбора для «Товарная продукция ОИС»: ГКП-21/22 или УКПГ-21/22 с начала имени."""
    return any(
        _sampling_location_name_starts_with(s, prefix)
        for prefix in TOVARNAYA_PRODUKCIYA_OIS_SAMPLING_PREFIXES
    )


def _is_ukpg_11v_location(s: Sample) -> bool:
    return _sampling_location_name_starts_with(s, SAMPLING_LOCATION_UKPG_11V)


def _is_valanzhin_ukpg_sampling_location(s: Sample) -> bool:
    """
    Место отбора с УКПГ-1АВ, УКПГ-1В, УКПГ-2В, УКПГ-5В или УКПГ-8В — в «ОИС Валанжин»,
    в прочие строки ОИС не входит. Допускается запись с продолжением (например «УКПГ-2В НСПК УУКГН»)
    и то же обозначение в середине длинного названия (отделено пробелом или запятой).
    """
    if not s.sampling_location:
        return False
    name = (s.sampling_location.name or "").strip()
    if not name:
        return False
    return any(rx.search(name) for rx in _VALANZHIN_UKPG_RE)


def _split_gkp_21_22_samples(items: list[Sample]) -> tuple[list[Sample], list[Sample]]:
    """ГКП-22 имеет приоритет: проба с префиксом 22 не попадает в блок 21."""
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
    return gkp21, gkp22


def _build_gkp_collapsed_block(
    prefix: str,
    subset: list[Sample],
    agg: dict[int, tuple[int, int]],
) -> list[str]:
    """
    Сводка по ГКП: заголовок с общим числом проб, затем группы по числу показателей
    (по возрастанию), внутри — даты получения и количество проб на дату.
    """
    if not subset:
        return []
    lines: list[str] = [f"{prefix} {len(subset)} шт"]
    by_pok: dict[int, list[Sample]] = defaultdict(list)
    for s in subset:
        pok = _map_display_pok_count(agg.get(s.id, (0, 0))[1])
        by_pok[pok].append(s)
    for pok in sorted(by_pok.keys()):
        lines.append(f"по {pok} пок")
        by_date: dict[Any, int] = defaultdict(int)
        for s in by_pok[pok]:
            by_date[s.receiving_date] += 1
        dated = sorted(
            ((dt, cnt) for dt, cnt in by_date.items() if dt is not None),
            key=lambda pair: pair[0],
        )
        for dt, cnt in dated:
            lines.append(f"{_fmt_date(dt)} {cnt} шт")
        no_date_cnt = by_date.get(None, 0)
        if no_date_cnt:
            lines.append(f"(дата получения не указана) {no_date_cnt} шт")
    return lines


def _build_gkp_21_22_collapsed_lines(
    gkp21: list[Sample],
    gkp22: list[Sample],
    agg: dict[int, tuple[int, int]],
) -> list[str]:
    lines: list[str] = []
    block21 = _build_gkp_collapsed_block(GKP_SAMPLING_NAME_PREFIX_21, gkp21, agg)
    block22 = _build_gkp_collapsed_block(GKP_SAMPLING_NAME_PREFIX_22, gkp22, agg)
    if block21:
        lines.extend(block21)
    if block21 and block22:
        lines.append("")
    if block22:
        lines.extend(block22)
    return lines


def _build_tovarnaya_neft_ngdu(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """Товарная нефть НГДУ: объект «нефть», без калибровочной, филиал НГДУ, без скважины."""
    items = [s for s in samples if _matches_tovarnaya_neft_ngdu_criteria(s)]
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
    return f"{len(items)} шт по {_map_display_pok_count(pok_count)} пок", items


def _build_ekspluatacionnaya_neft_ngdu(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """Эксплуатационная нефть НГДУ: цехи ДГГКН №1/№2, «нефть», не калибровочная; скважина обязательна."""
    items = [s for s in samples if _matches_ekspluatacionnaya_neft_ngdu_criteria(s)]
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
        lines.append(f"{cnt} шт по {_map_display_pok_count(pok)} пок")
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
        f"{c} шт"
        for loc_name in ("Цех по ДГГКН №2", "Цех по ДГГКН №1")
        for c in [by_loc.get(loc_name, 0)]
        if c > 0
    ]
    if not parts:
        return "", items
    lines = [f"{sum(by_loc.values())} шт"]
    for loc_name in ("Цех по ДГГКН №2", "Цех по ДГГКН №1"):
        if by_loc.get(loc_name, 0) > 0:
            lines.append(DISPLAY_NAMES_CDGGKN.get(loc_name, loc_name))
    return ("\n".join(lines) if lines else ""), items


def _build_vneplanovye(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """
    Внеплановые по филиалу: тип пробы «Внеплановые», любой объект испытаний.

    Строки: место отбора; при наличии через пробел — скважина и режим; сумма показателей в «по N пок».
    """
    items = [s for s in samples if _is_vneplanovye_sample(s)]
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
        lines.append(f"{text} по {_map_display_pok_count(pok)} пок")
    return "\n".join(lines), items


def _build_pasportizaciya(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """
    Паспортизация: пробы с типом «Паспортизация».

    Места отбора с префиксом ГКП-21 и ГКП-22 сюда не входят — они только в «ГКП-21 ГКП-22».
    """
    items = [
        s
        for s in samples
        if _sample_type_equals(s, "Паспортизация") and not _is_gkp_21_or_22_location(s)
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
        cnt = len(loc_samples)
        pok = sum(agg.get(s.id, (0, 0))[1] for s in loc_samples)
        lines.append(f"{loc_name} - {cnt} шт по {_map_display_pok_count(pok)} пок")
    return "\n".join(lines), items


def _build_gkp_21_gkp_22(
    samples: list[Sample],
    agg: dict[int, tuple[int, int]],
    sample_type: str = "Паспортизация",
) -> tuple[str, list[Sample]]:
    """Паспортизация по ГКП-21/22: сводка по показателям и датам получения."""
    items = [
        s
        for s in samples
        if _sample_type_equals(s, sample_type) and _is_gkp_21_or_22_location(s)
    ]
    if not items:
        return "", []
    gkp21, gkp22 = _split_gkp_21_22_samples(items)
    lines = _build_gkp_21_22_collapsed_lines(gkp21, gkp22, agg)
    return "\n".join(lines), items


def _build_ois_achimovka(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """
    ОИС Ачимовка: тип «Исследования - ОИС», место отбора с префиксом ГКП-21 или ГКП-22.

    УКПГ-1АВ, УКПГ-1В, УКПГ-2В, УКПГ-5В, УКПГ-8В сюда не включаются — только «ОИС Валанжин».

    Без признака «товарная продукция» в режиме (для старых записей — и в скважине).

    По каждому префиксу — тот же формат, что у «ГКП-21 ГКП-22»: показатели и даты.
    """
    items = [
        s
        for s in samples
        if _sample_type_equals(s, "Исследования - ОИС")
        and _is_gkp_21_or_22_location(s)
        and not _sample_indicates_tovarnaya_produkciya(s)
        and not _is_valanzhin_ukpg_sampling_location(s)
    ]
    if not items:
        return "", []
    gkp21, gkp22 = _split_gkp_21_22_samples(items)
    lines = _build_gkp_21_22_collapsed_lines(gkp21, gkp22, agg)
    return "\n".join(lines), items


def _build_ois_valanzhin(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """
    ОИС Валанжин: только «Исследования - ОИС» с местом отбора по УКПГ-1АВ, УКПГ-1В, УКПГ-2В, УКПГ-5В, УКПГ-8В
    (в т.ч. с продолжением в названии, например «УКПГ-2В НСПК УУКГН»), без признака товарной продукции в режиме или скважине.
    """
    items = [
        s
        for s in samples
        if _sample_type_equals(s, "Исследования - ОИС")
        and _is_valanzhin_ukpg_sampling_location(s)
        and not _sample_indicates_tovarnaya_produkciya(s)
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
            f"{len(loc_samples)} шт {loc_name} по {_map_display_pok_count(pok)} пок"
        )
    return "\n\n".join(lines), items


def _build_ois_en_yaha(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """ОИС Ен-Яха: «Исследования - ОИС», место отбора с префиксом УКПГ-11В; УКПГ-1АВ, УКПГ-1В, УКПГ-2В, УКПГ-5В, УКПГ-8В сюда не входят — только «ОИС Валанжин»."""
    items = [
        s
        for s in samples
        if _sample_type_equals(s, "Исследования - ОИС")
        and _is_ukpg_11v_location(s)
        and not _sample_indicates_tovarnaya_produkciya(s)
        and not _is_valanzhin_ukpg_sampling_location(s)
    ]
    if not items:
        return "", []
    by_loc: dict[str, list[Sample]] = defaultdict(list)
    for s in items:
        name = (s.sampling_location.name or "").strip() if s.sampling_location else ""
        key = name if name else "(место отбора не указано)"
        by_loc[key].append(s)
    lines = [f"{len(items)} шт"]
    for loc_name in sorted(by_loc.keys()):
        loc_samples = by_loc[loc_name]
        pok = sum(agg.get(s.id, (0, 0))[1] for s in loc_samples)
        lines.append(f"{loc_name} по {_map_display_pok_count(pok)} пок")
    return "\n".join(lines), items


def _build_ois(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """ОИС: «Исследования - ОИС», цехи ДГГКН №1/№2, филиалы НГДУ/УГПУ/ГПУпРАО, скважина обязательна; без товарной продукции в режиме или скважине; УКПГ-1АВ, УКПГ-1В, УКПГ-2В, УКПГ-5В, УКПГ-8В сюда не входят — только «ОИС Валанжин»."""
    allowed_branches = (BRANCH_NGDU, BRANCH_UGPU, BRANCH_GPU_PRAO)
    items = [
        s
        for s in samples
        if _sample_type_equals(s, "Исследования - ОИС")
        and _sampling_location_name_in(s, SAMPLING_LOCATIONS_CDGGKN)
        and any(_branch_name_equals(s, branch_name) for branch_name in allowed_branches)
        and (s.well or "").strip()
        and not _sample_indicates_tovarnaya_produkciya(s)
        and not _is_valanzhin_ukpg_sampling_location(s)
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
        lines.append(f"{len(loc_samples)} шт по {_map_display_pok_count(pok)} пок")
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
    """Товарная продукция ОИС: ОИС по ГКП-21/22 или УКПГ-21/22, в режиме (или в скважине — старые данные) есть «товарная продукция», вывод — даты; УКПГ-1АВ, УКПГ-1В, УКПГ-2В, УКПГ-5В, УКПГ-8В сюда не входят — только «ОИС Валанжин»."""
    del agg
    allowed_branches = (BRANCH_NGDU, BRANCH_UGPU, BRANCH_GPU_PRAO)
    items = [
        s
        for s in samples
        if _sample_type_equals(s, "Исследования - ОИС")
        and _is_tovarnaya_produkciya_ois_location(s)
        and any(_branch_name_equals(s, branch_name) for branch_name in allowed_branches)
        and _sample_indicates_tovarnaya_produkciya(s)
        and not _is_valanzhin_ukpg_sampling_location(s)
    ]
    if not items:
        return "", []
    blocks: list[list[str]] = []
    for title in TOVARNAYA_PRODUKCIYA_OIS_SAMPLING_PREFIXES:
        subset = [s for s in items if _sampling_location_name_starts_with(s, title)]
        if not subset:
            continue
        block = [title]
        for s in sorted(
            subset, key=lambda x: (x.receiving_date or pendulum.date(1900, 1, 1), x.id)
        ):
            block.append(
                _fmt_date(s.receiving_date)
                if s.receiving_date
                else "(дата получения не указана)"
            )
        blocks.append(block)
    lines: list[str] = []
    for idx, block in enumerate(blocks):
        if idx > 0:
            lines.append("")
        lines.extend(block)
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
    lines = [f"{len(items)} шт"]
    for loc_name in sorted(by_loc.keys()):
        lines.append(f"{loc_name} - {by_loc[loc_name]} шт")
    return "\n".join(lines), items


def _build_prochie(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """
    Прочие: место отбора (+ скважина/режим), дата отбора и сумма показателей.

    У филиала НГДУ не включаем пробы, которые попадают в «Товарная нефть НГДУ» или «Эксплуатационная нефть НГДУ».
    """
    items = [
        s
        for s in samples
        if _sample_type_equals(s, "Исследования - прочие")
        and not _test_object_ilike(s, "дизельное топливо")
        and not _test_object_ilike(s, "ингибитор коррозии")
        and not _test_object_ilike(s, "нефтеконденсатная смесь")
        and not _matches_tovarnaya_neft_ngdu_criteria(s)
        and not _matches_ekspluatacionnaya_neft_ngdu_criteria(s)
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
    lines = [f"{total} шт"]
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
        lines.append(f"{text} от {date_part} по {_map_display_pok_count(pok)} пок")
    return "\n".join(lines), items


def _build_by_test_object_place_date(
    samples: list[Sample],
    agg: dict[int, tuple[int, int]],
    object_key: str,
) -> tuple[str, list[Sample]]:
    """Строка отчёта по объекту испытаний: шт, место отбора, дата получения, показатели."""
    items = [s for s in samples if _test_object_ilike(s, object_key)]
    if not items:
        return "", []
    by_place_date: dict[tuple[str, Optional[pendulum.Date]], list[Sample]] = (
        defaultdict(list)
    )
    for s in items:
        place = (s.sampling_location.name or "").strip() if s.sampling_location else ""
        by_place_date[(place, s.receiving_date)].append(s)
    lines: list[str] = []
    for (place, dt), loc_samples in sorted(
        by_place_date.items(),
        key=lambda x: (x[0][0], x[0][1] or pendulum.date(1900, 1, 1)),
    ):
        cnt = len(loc_samples)
        pok = sum(agg.get(s.id, (0, 0))[1] for s in loc_samples)
        lines.append(
            f"{cnt} шт {place} от {_fmt_date(dt)} по {_map_display_pok_count(pok)} пок"
        )
    return ("\n".join(lines) if lines else ""), items


def _build_diztoplivo(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """Дизтопливо: объект испытаний «дизельное топливо»."""
    return _build_by_test_object_place_date(samples, agg, "дизельное топливо")


def _build_ingibitor(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> tuple[str, list[Sample]]:
    """Ингибитор коррозии: объект испытаний «ингибитор коррозии»."""
    return _build_by_test_object_place_date(samples, agg, "ингибитор коррозии")


def _build_all_row_values(
    samples: list[Sample], agg: dict[int, tuple[int, int]]
) -> dict[str, str]:
    """Строит значение для каждой строки отчёта (ключ — заголовок строки)."""
    builders = {
        ROW_TITLE_TOVARNAYA_NEFT_NGDU: _build_tovarnaya_neft_ngdu,
        ROW_TITLE_EKSPLUATACIONNAYA_NEFT_NGDU: _build_ekspluatacionnaya_neft_ngdu,
        ROW_TITLE_KALIBROVOCHNAYA_NEFT_UGPU: _build_kalibrovochnaya_neft_ugpu,
        ROW_TITLE_VNEPLANOVYE: _build_vneplanovye,
        ROW_TITLE_PASPORTIZACIYA: _build_pasportizaciya,
        ROW_TITLE_GKP_21_GKP_22: _build_gkp_21_gkp_22,
        ROW_TITLE_OIS: _build_ois,
        ROW_TITLE_TOVARNAYA_PRODUKCIYA_OIS: _build_tovarnaya_produkciya_ois,
        ROW_TITLE_OIS_ACHIMOVKA: _build_ois_achimovka,
        ROW_TITLE_OIS_VALANZHIN: _build_ois_valanzhin,
        ROW_TITLE_OIS_EN_YAHA: _build_ois_en_yaha,
        ROW_TITLE_PROCHIE: _build_prochie,
        ROW_TITLE_NEFTECONDENSATNAYA_SMES: _build_neftecondensatnaya_smes,
        ROW_TITLE_DIZTOPIVO: _build_diztoplivo,
        ROW_TITLE_INGIBITOR: _build_ingibitor,
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
    mode = (s.mode or "").strip() or "-"
    dt = _fmt_date(s.receiving_date) if s.receiving_date else "-"
    test_object = (s.test_object or "").strip() or "-"
    sample_type = (s.sample_type or "").strip() or "-"
    return (
        f"рег. номер={reg}; "
        f"тип пробы={sample_type}; "
        f"объект испытания={test_object}; "
        f"место отбора={place}; "
        f"скважина={well}; "
        f"режим={mode}; "
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
    lines.append(
        "Признак «товарная продукция» для строк ОИС: ищется в поле «режим»; "
        "поле «скважина» проверяется для совместимости со старыми данными."
    )
    lines.append("")

    included_global: set[int] = set()
    usage_global: dict[int, set[str]] = defaultdict(set)
    samples_by_id = {s.id: s for s in samples}

    branches_seen: dict[int, tuple[int, str]] = {}
    for s in samples:
        if s.branch_id and s.branch:
            branches_seen[s.branch_id] = (s.branch_id, (s.branch.name or "").strip())

    builders = {
        ROW_TITLE_TOVARNAYA_NEFT_NGDU: _build_tovarnaya_neft_ngdu,
        ROW_TITLE_EKSPLUATACIONNAYA_NEFT_NGDU: _build_ekspluatacionnaya_neft_ngdu,
        ROW_TITLE_KALIBROVOCHNAYA_NEFT_UGPU: _build_kalibrovochnaya_neft_ugpu,
        ROW_TITLE_VNEPLANOVYE: _build_vneplanovye,
        ROW_TITLE_PASPORTIZACIYA: _build_pasportizaciya,
        ROW_TITLE_GKP_21_GKP_22: _build_gkp_21_gkp_22,
        ROW_TITLE_OIS: _build_ois,
        ROW_TITLE_TOVARNAYA_PRODUKCIYA_OIS: _build_tovarnaya_produkciya_ois,
        ROW_TITLE_OIS_ACHIMOVKA: _build_ois_achimovka,
        ROW_TITLE_OIS_VALANZHIN: _build_ois_valanzhin,
        ROW_TITLE_OIS_EN_YAHA: _build_ois_en_yaha,
        ROW_TITLE_PROCHIE: _build_prochie,
        ROW_TITLE_NEFTECONDENSATNAYA_SMES: _build_neftecondensatnaya_smes,
        ROW_TITLE_DIZTOPIVO: _build_diztoplivo,
        ROW_TITLE_INGIBITOR: _build_ingibitor,
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
            if not is_sample_count_row_visible_for_branch(
                row_title, branch_name, row_titles_for_branch
            ):
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
        for sid, row_titles in usage_by_sample.items():
            usage_global[sid].update(row_titles)
        lines.append(
            f"Повторяются в нескольких строках отчёта (по филиалу): {len(repeated_rows)}"
        )
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
    repeated_period = {
        sid: titles for sid, titles in usage_global.items() if len(titles) > 1
    }
    lines.append(
        f"Повторяются в нескольких строках отчёта (сводка за период): {len(repeated_period)}"
    )
    for sid in sorted(repeated_period.keys()):
        sample = samples_by_id.get(sid)
        if not sample:
            continue
        joined_rows = ", ".join(sorted(repeated_period[sid]))
        lines.append(f"- {_sample_debug_label(sample)}; rows={joined_rows}")
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
            if not is_sample_count_row_visible_for_branch(
                row_title, branch_name, row_titles_for_branch
            ):
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
    ROW_TITLE_VNEPLANOVYE: None,
    ROW_TITLE_PASPORTIZACIYA: None,
    ROW_TITLE_GKP_21_GKP_22: None,
    ROW_TITLE_OIS: None,
    ROW_TITLE_TOVARNAYA_PRODUKCIYA_OIS: None,
    ROW_TITLE_OIS_ACHIMOVKA: None,
    ROW_TITLE_OIS_VALANZHIN: None,
    ROW_TITLE_OIS_EN_YAHA: None,
    ROW_TITLE_PROCHIE: None,
    ROW_TITLE_NEFTECONDENSATNAYA_SMES: None,
    ROW_TITLE_DIZTOPIVO: None,
    ROW_TITLE_INGIBITOR: None,
}

# Строки, которые не выводятся в блоке указанных филиалов.
ROW_TITLE_EXCLUDED_BRANCHES: dict[str, tuple[str, ...]] = {
    ROW_TITLE_PASPORTIZACIYA: (BRANCH_GPU_PRAO, BRANCH_NGDU),
    ROW_TITLE_GKP_21_GKP_22: (BRANCH_NGDU, BRANCH_UGPU),
    ROW_TITLE_OIS_VALANZHIN: (BRANCH_GPU_PRAO, BRANCH_NGDU),
    ROW_TITLE_OIS_EN_YAHA: (BRANCH_GPU_PRAO, BRANCH_NGDU),
    ROW_TITLE_NEFTECONDENSATNAYA_SMES: (BRANCH_GPU_PRAO, BRANCH_NGDU),
    ROW_TITLE_OIS_ACHIMOVKA: (BRANCH_NGDU, BRANCH_UGPU),
    ROW_TITLE_TOVARNAYA_PRODUKCIYA_OIS: (BRANCH_NGDU, BRANCH_UGPU),
    ROW_TITLE_OIS: (BRANCH_UGPU, BRANCH_GPU_PRAO),
}


def is_sample_count_row_visible_for_branch(
    row_title: str,
    branch_name: str,
    row_titles_for_branch: dict[str, Optional[str]],
) -> bool:
    """Проверяет, нужно ли показывать строку отчёта в блоке филиала."""
    only_branch = row_titles_for_branch.get(row_title)
    if only_branch is not None and only_branch != branch_name:
        return False
    excluded = ROW_TITLE_EXCLUDED_BRANCHES.get(row_title)
    if excluded and branch_name in excluded:
        return False
    return True


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
        "total_samples": len(samples),
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
