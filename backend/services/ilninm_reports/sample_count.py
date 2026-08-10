"""
Отчёт «Количество проб» для лаборатории ИЛНиНМ.

Собирает по пробам за период (по дате получения) количество показателей из поля пробы,
группирует по типам строк отчёта и по branch_id. В тексте отчёта выводятся даты отбора проб.
Пустые строки (0 шт / 0 пок) не выводятся. В отчёт попадают только неудалённые пробы.

Места отбора с префиксами «ГКП-21» и «ГКП-22» сопоставляются по началу имени.
"""

from collections import defaultdict
from dataclasses import dataclass, field
import re
from typing import Any
import pendulum
from sqlalchemy.ext.asyncio import AsyncSession
from core.logger import logger
from models.sample import Sample
from repositories import sample as sample_repo
from utils.ilninm_constants import DISPLAY_NAMES_CDGGKN, SAMPLING_LOCATIONS_CDGGKN
from utils.sample_formatting import format_well_display
from .constants import (
    BRANCH_GPU_PRAO,
    BRANCH_NGDU,
    BRANCH_UGPU,
    GKP_SAMPLING_NAME_PREFIX_21,
    GKP_SAMPLING_NAME_PREFIX_22,
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
    TOVARNAYA_PRODUKCIYA_OIS_SAMPLING_PREFIXES,
)

# УКПГ-1АВ, УКПГ-1В, УКПГ-2В, УКПГ-5В, УКПГ-8В в названии места отбора: с начала или после пробела/запятой,
# затем снова пробел, запятая или конец строки — чтобы сработало к примеру на «УКПГ-2В НСПК УУКГН», и вхождение в длинную строку.
_VALANZHIN_UKPG_RE = tuple(
    re.compile(rf"(?:^|[\s,;]){re.escape(p)}(?=[\s,;]|$)") for p in SAMPLING_LOCATION_PREFIXES_VALANZHIN_UKPG
)


@dataclass
class BranchRows:
    """Строки отчёта по одному филиалу."""

    branch_id: int
    branch_name: str
    rows: list[dict[str, str]] = field(default_factory=list)


def _fmt_date(d: pendulum.Date | None) -> str:
    if d is None:
        return ""
    return pendulum.instance(d).format("DD.MM.YYYY")


def _sample_report_date(s: Sample) -> pendulum.Date | None:
    """Дата отбора пробы для вывода в отчёте (выборка проб — по дате получения)."""
    return s.sampling_date


def _sample_report_date_sort_key(s: Sample) -> pendulum.Date:
    return _sample_report_date(s) or pendulum.date(1900, 1, 1)


def _sample_indicators_count(s: Sample) -> int:
    """Количество показателей из поля пробы."""
    return s.indicators_count


async def _get_samples_in_range(
    db: AsyncSession,
    laboratory_id: int,
    receiving_date_from: pendulum.DateTime | None,
    receiving_date_to: pendulum.DateTime | None,
    department_id: int | None = None,
) -> list[Sample]:
    """Пробы за период по дате получения с загрузкой branch и sampling_location."""
    return await sample_repo.get_samples_by_receiving_date_range(
        db,
        laboratory_id,
        receiving_date_from,
        receiving_date_to,
        department_id,
    )


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
    return _sampling_location_name_starts_with(s, GKP_SAMPLING_NAME_PREFIX_21) or _sampling_location_name_starts_with(
        s, GKP_SAMPLING_NAME_PREFIX_22
    )


def _is_tovarnaya_produkciya_ois_location(s: Sample) -> bool:
    """Место отбора для «Товарная продукция ОИС»: ГКП-21/22 или УКПГ-21/22 с начала имени."""
    return any(_sampling_location_name_starts_with(s, prefix) for prefix in TOVARNAYA_PRODUKCIYA_OIS_SAMPLING_PREFIXES)


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
    gkp22 = [s for s in items if _sampling_location_name_starts_with(s, GKP_SAMPLING_NAME_PREFIX_22)]
    in_gkp22 = {id(s) for s in gkp22}
    gkp21 = [
        s
        for s in items
        if _sampling_location_name_starts_with(s, GKP_SAMPLING_NAME_PREFIX_21) and id(s) not in in_gkp22
    ]
    return gkp21, gkp22


def _build_gkp_collapsed_block(
    prefix: str,
    subset: list[Sample],
) -> list[str]:
    """
    Сводка по ГКП: заголовок с общим числом проб, затем группы по числу показателей
    (по возрастанию), внутри — даты отбора и количество проб на дату.
    """
    if not subset:
        return []
    lines: list[str] = [f"{prefix} {len(subset)} шт"]
    by_pok: dict[int, list[Sample]] = defaultdict(list)
    for s in subset:
        pok = _sample_indicators_count(s)
        by_pok[pok].append(s)
    for pok in sorted(by_pok.keys()):
        lines.append(f"по {pok} пок")
        by_date: dict[Any, int] = defaultdict(int)
        for s in by_pok[pok]:
            by_date[_sample_report_date(s)] += 1
        dated = sorted(
            ((dt, cnt) for dt, cnt in by_date.items() if dt is not None),
            key=lambda pair: pair[0],
        )
        for dt, cnt in dated:
            lines.append(f"{_fmt_date(dt)} {cnt} шт")
        no_date_cnt = by_date.get(None, 0)
        if no_date_cnt:
            lines.append(f"(дата отбора не указана) {no_date_cnt} шт")
    return lines


def _build_gkp_21_22_collapsed_lines(
    gkp21: list[Sample],
    gkp22: list[Sample],
) -> list[str]:
    lines: list[str] = []
    block21 = _build_gkp_collapsed_block(GKP_SAMPLING_NAME_PREFIX_21, gkp21)
    block22 = _build_gkp_collapsed_block(GKP_SAMPLING_NAME_PREFIX_22, gkp22)
    if block21:
        lines.extend(block21)
    if block21 and block22:
        lines.append("")
    if block22:
        lines.extend(block22)
    return lines


def _build_pok_distribution_lines(
    subset: list[Sample],
) -> list[str]:
    """Распределение проб по числу показателей: «по N пок M шт»."""
    if not subset:
        return []
    by_pok: dict[int, int] = defaultdict(int)
    for s in subset:
        pok = _sample_indicators_count(s)
        by_pok[pok] += 1
    return [f"по {pok} пок {by_pok[pok]} шт" for pok in sorted(by_pok.keys())]


def _build_tovarnaya_neft_ngdu(
    samples: list[Sample],
) -> tuple[str, list[Sample]]:
    """Товарная нефть НГДУ: объект «нефть», без калибровочной, филиал НГДУ, без скважины."""
    items = [s for s in samples if _matches_tovarnaya_neft_ngdu_criteria(s)]
    if not items:
        return "", []
    lines = _build_pok_distribution_lines(items)
    return ("\n".join(lines) if lines else ""), items


def _build_ekspluatacionnaya_neft_ngdu(
    samples: list[Sample],
) -> tuple[str, list[Sample]]:
    """Эксплуатационная нефть НГДУ: цехи ДГГКН №1/№2, «нефть», не калибровочная; скважина обязательна."""
    items = [s for s in samples if _matches_ekspluatacionnaya_neft_ngdu_criteria(s)]
    if not items:
        return "", []
    by_pok: dict[int, list[Sample]] = defaultdict(list)
    for s in items:
        pok = _sample_indicators_count(s)
        by_pok[pok].append(s)

    lines: list[str] = []
    for pok in sorted(by_pok.keys()):
        group = by_pok[pok]
        lines.append(f"по {pok} пок {len(group)} шт")
        for s in sorted(
            group,
            key=lambda x: (
                _sample_report_date_sort_key(x),
                (x.sampling_location.name or "").strip() if x.sampling_location else "",
                x.well or "",
            ),
        ):
            if not (s.well or "").strip():
                continue
            raw_loc_name = (s.sampling_location.name or "").strip() if s.sampling_location else ""
            display_name = DISPLAY_NAMES_CDGGKN.get(raw_loc_name, raw_loc_name)
            report_date = _sample_report_date(s)
            date_part = _fmt_date(report_date) if report_date else "(дата отбора не указана)"
            lines.append(f"{display_name} {format_well_display(s.well)} от {date_part}")
        lines.append("")
    if lines and lines[-1] == "":
        lines.pop()
    return ("\n".join(lines) if lines else ""), items


def _build_kalibrovochnaya_neft_ugpu(
    samples: list[Sample],
) -> tuple[str, list[Sample]]:
    """Калибровочная нефть УГПУ: объект «нефть калибровочная», филиал УГПУ."""
    items = [s for s in samples if _branch_name_equals(s, BRANCH_UGPU) and _test_object_ilike(s, "нефть калибровочная")]
    if not items:
        return "", []
    by_loc: dict[str, int] = defaultdict(int)
    for s in items:
        by_loc[_sampling_location_display_name(s)] += 1
    lines = [f"{len(items)} шт"]
    for loc_name in sorted(by_loc.keys()):
        lines.append(loc_name)
    return ("\n".join(lines) if lines else ""), items


def _build_vneplanovye(
    samples: list[Sample],
) -> tuple[str, list[Sample]]:
    """
    Внеплановые по филиалу: тип пробы «Внеплановые», любой объект испытаний.

    Строки: место отбора; при наличии — скважина и режим; дата отбора; сумма показателей в «по N пок».
    """
    items = [s for s in samples if _is_vneplanovye_sample(s)]
    if not items:
        return "", []
    by_key: dict[tuple[str, str, str, pendulum.Date | None], list[Sample]] = defaultdict(list)
    for s in items:
        place = _sampling_location_display_name(s)
        well_key = (s.well or "").strip()
        mode_key = (s.mode or "").strip()
        dt_key = _sample_report_date(s)
        by_key[(place, well_key, mode_key, dt_key)].append(s)
    lines: list[str] = []
    for key in sorted(
        by_key.keys(),
        key=lambda x: (
            x[0],
            x[1],
            x[2],
            x[3] or pendulum.date(1900, 1, 1),
        ),
    ):
        group = by_key[key]
        place, well_key, mode_key, dt_key = key
        pok = sum(_sample_indicators_count(s) for s in group)
        date_part = _fmt_date(dt_key) if dt_key else "(дата отбора не указана)"
        text = place
        well_display = format_well_display(well_key)
        if well_display:
            text += f" {well_display}"
        if mode_key:
            text += f" {mode_key}"
        lines.append(f"{text} от {date_part} по {pok} пок")
    return "\n".join(lines), items


def _build_pasportizaciya(
    samples: list[Sample],
) -> tuple[str, list[Sample]]:
    """
    Паспортизация: пробы с типом «Паспортизация».

    Места отбора с префиксом ГКП-21 и ГКП-22 сюда не входят — они только в «ГКП-21 ГКП-22».
    """
    items = [s for s in samples if _sample_type_equals(s, "Паспортизация") and not _is_gkp_21_or_22_location(s)]
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
        distribution = _build_pok_distribution_lines(loc_samples)
        if not distribution:
            continue
        lines.append(loc_name)
        lines.extend(distribution)
    return "\n".join(lines), items


def _build_gkp_21_gkp_22(
    samples: list[Sample],
    sample_type: str = "Паспортизация",
) -> tuple[str, list[Sample]]:
    """Паспортизация по ГКП-21/22: сводка по показателям и датам отбора."""
    items = [s for s in samples if _sample_type_equals(s, sample_type) and _is_gkp_21_or_22_location(s)]
    if not items:
        return "", []
    gkp21, gkp22 = _split_gkp_21_22_samples(items)
    lines = _build_gkp_21_22_collapsed_lines(gkp21, gkp22)
    return "\n".join(lines), items


def _build_ois_achimovka(
    samples: list[Sample],
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
    lines = _build_gkp_21_22_collapsed_lines(gkp21, gkp22)
    return "\n".join(lines), items


def _build_ois_valanzhin(
    samples: list[Sample],
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
        distribution = _build_pok_distribution_lines(loc_samples)
        if not distribution:
            continue
        lines.append(loc_name)
        lines.extend(distribution)
        lines.append("")
    if lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines), items


def _build_ois_en_yaha(
    samples: list[Sample],
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
        pok = sum(_sample_indicators_count(s) for s in loc_samples)
        lines.append(f"{loc_name} по {pok} пок")
    return "\n".join(lines), items


def _build_ois(
    samples: list[Sample],
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
        lines.extend(_build_pok_distribution_lines(loc_samples))
        display_name = DISPLAY_NAMES_CDGGKN.get(loc_name, loc_name)
        for s in sorted(
            loc_samples,
            key=lambda x: (
                _sample_report_date_sort_key(x),
                (x.well or "").strip(),
                x.id,
            ),
        ):
            well_key = (s.well or "").strip()
            report_date = _sample_report_date(s)
            date_part = _fmt_date(report_date) if report_date else "(дата отбора не указана)"
            lines.append(f"{display_name} {format_well_display(well_key)} от {date_part}")
        lines.append("")
    if lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines), items


def _build_tovarnaya_produkciya_ois(
    samples: list[Sample],
) -> tuple[str, list[Sample]]:
    """Товарная продукция ОИС: ОИС по ГКП-21/22 или УКПГ-21/22, в режиме (или в скважине — старые данные) есть «товарная продукция», вывод — даты; УКПГ-1АВ, УКПГ-1В, УКПГ-2В, УКПГ-5В, УКПГ-8В сюда не входят — только «ОИС Валанжин»."""
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
        for s in sorted(subset, key=lambda x: (_sample_report_date_sort_key(x), x.id)):
            report_date = _sample_report_date(s)
            block.append(_fmt_date(report_date) if report_date else "(дата отбора не указана)")
        blocks.append(block)
    lines: list[str] = []
    for idx, block in enumerate(blocks):
        if idx > 0:
            lines.append("")
        lines.extend(block)
    return "\n".join(lines), items


def _build_neftecondensatnaya_smes(
    samples: list[Sample],
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
    samples: list[Sample],
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
    by_key: dict[tuple[str, str, str, pendulum.Date | None], list[Sample]] = defaultdict(list)
    for s in items:
        place = (s.sampling_location.name or "").strip() if s.sampling_location else ""
        place_key = place if place else "(место отбора не указано)"
        well_key = (s.well or "").strip()
        mode_key = (s.mode or "").strip()
        dt_key = _sample_report_date(s)
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
        pok = sum(_sample_indicators_count(s) for s in group)
        date_part = _fmt_date(dt_key) if dt_key else "(дата отбора не указана)"

        text = place_key
        well_display = format_well_display(well_key)
        if well_display:
            text += f" {well_display}"
        if mode_key:
            text += f" {mode_key}"
        lines.append(f"{text} от {date_part} по {pok} пок")
    return "\n".join(lines), items


def _build_by_test_object_place_date(
    samples: list[Sample],
    object_key: str,
) -> tuple[str, list[Sample]]:
    """Строка отчёта по объекту испытаний: шт, место отбора, дата отбора, показатели."""
    items = [s for s in samples if _test_object_ilike(s, object_key)]
    if not items:
        return "", []
    by_place_date: dict[tuple[str, pendulum.Date | None], list[Sample]] = defaultdict(list)
    for s in items:
        place = (s.sampling_location.name or "").strip() if s.sampling_location else ""
        by_place_date[(place, _sample_report_date(s))].append(s)
    lines: list[str] = []
    for (place, dt), loc_samples in sorted(
        by_place_date.items(),
        key=lambda x: (x[0][0], x[0][1] or pendulum.date(1900, 1, 1)),
    ):
        distribution = _build_pok_distribution_lines(loc_samples)
        date_part = _fmt_date(dt) if dt else "(дата отбора не указана)"
        for part in distribution:
            lines.append(f"{part} {place} от {date_part}")
    return ("\n".join(lines) if lines else ""), items


def _build_diztoplivo(
    samples: list[Sample],
) -> tuple[str, list[Sample]]:
    """Дизтопливо: объект испытаний «дизельное топливо»."""
    return _build_by_test_object_place_date(samples, "дизельное топливо")


def _build_ingibitor(
    samples: list[Sample],
) -> tuple[str, list[Sample]]:
    """Ингибитор коррозии: объект испытаний «ингибитор коррозии»."""
    return _build_by_test_object_place_date(samples, "ингибитор коррозии")


def _build_all_row_values(
    samples: list[Sample],
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
        value, used = builder(samples)
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
    report_date = _sample_report_date(s)
    dt = _fmt_date(report_date) if report_date else "-"
    indicators_count = _sample_indicators_count(s)
    test_object = (s.test_object or "").strip() or "-"
    sample_type = (s.sample_type or "").strip() or "-"
    return (
        f"рег. номер={reg}; "
        f"тип пробы={sample_type}; "
        f"объект испытания={test_object}; "
        f"место отбора={place}; "
        f"скважина={well}; "
        f"режим={mode}; "
        f"дата отбора={dt}; "
        f"количество показателей={indicators_count}"
    )


def _build_sample_count_diagnostics_text(
    samples: list[Sample],
    row_titles_for_branch: dict[str, str | None],
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
        branch_samples = [s for s in samples if s.branch and (s.branch.name or "").strip() == branch_name]
        lines.append(f"=== Филиал: {branch_name} ===")
        lines.append(f"Всего проб филиала за период: {len(branch_samples)}")
        branch_included: set[int] = set()
        usage_by_sample: dict[int, set[str]] = defaultdict(set)

        for row_title, builder in builders.items():
            if not is_sample_count_row_visible_for_branch(row_title, branch_name, row_titles_for_branch):
                continue
            value, used = builder(branch_samples)
            if not value or not used:
                continue
            lines.append(f"- {row_title}: {len(used)} проб")
            for s in sorted(
                used,
                key=lambda x: (_sample_report_date_sort_key(x), x.id),
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
            key=lambda x: (_sample_report_date_sort_key(x), x.id),
        ):
            lines.append(f"  - {_sample_debug_label(s)}")

        repeated_rows = {sid: rows for sid, rows in usage_by_sample.items() if len(rows) > 1}
        for sid, row_titles in usage_by_sample.items():
            usage_global[sid].update(row_titles)
        lines.append(f"Повторяются в нескольких строках отчёта (по филиалу): {len(repeated_rows)}")
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
        key=lambda x: (_sample_report_date_sort_key(x), x.id),
    ):
        lines.append(f"- {_sample_debug_label(s)}")
    repeated_period = {sid: titles for sid, titles in usage_global.items() if len(titles) > 1}
    lines.append(f"Повторяются в нескольких строках отчёта (сводка за период): {len(repeated_period)}")
    for sid in sorted(repeated_period.keys()):
        sample = samples_by_id.get(sid)
        if not sample:
            continue
        joined_rows = ", ".join(sorted(repeated_period[sid]))
        lines.append(f"- {_sample_debug_label(sample)}; rows={joined_rows}")
    return "\n".join(lines)


def _split_by_branch(
    samples: list[Sample],
    row_titles_for_branch: dict[str, str | None],
) -> list[BranchRows]:
    """Разбивает отчёт по branch_id. row_titles_for_branch: заголовок строки -> branch name (None = по всем)."""
    branches_seen: dict[int, tuple[int, str]] = {}
    for s in samples:
        if s.branch_id and s.branch:
            branches_seen[s.branch_id] = (s.branch_id, (s.branch.name or "").strip())

    result: list[BranchRows] = []
    for branch_id, branch_name in branches_seen.values():
        branch_samples = [s for s in samples if s.branch_id == branch_id]
        row_values = _build_all_row_values(branch_samples)
        rows = []
        for row_title, value in row_values.items():
            if not is_sample_count_row_visible_for_branch(row_title, branch_name, row_titles_for_branch):
                continue
            if value:
                rows.append({"label": row_title, "value": value})
        if rows:
            result.append(BranchRows(branch_id=branch_id, branch_name=branch_name, rows=rows))
    return result


# Какие строки привязаны к филиалу по названию (остальные — общие по лаборатории, но мы режем по branch).
ROW_TITLE_TO_BRANCH: dict[str, str | None] = {
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
    row_titles_for_branch: dict[str, str | None],
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


def match_row_title_to_value(cell_a_value: Any, row_values: dict[str, str]) -> str | None:
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
    receiving_date_from: pendulum.DateTime | None,
    receiving_date_to: pendulum.DateTime | None,
    department_id: int | None = None,
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

    preliminary = _build_all_row_values(samples)
    by_branch = _split_by_branch(samples, ROW_TITLE_TO_BRANCH)

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
        "diagnostics_txt": _build_sample_count_diagnostics_text(samples, ROW_TITLE_TO_BRANCH),
    }
