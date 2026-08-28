from collections import defaultdict
import re
import pendulum
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import DomainValidationError
from models.research import ResearchMethod
from repositories import research as research_repo
from schemas.sample import SampleResponse
from schemas.sample_export import (
    ResearchMethodExportInfo,
    ResearchMethodGroupExportInfo,
    SampleExportCalculation,
    SampleExportItem,
)
from services.calculation.service import get_calculations_by_sample
from services.sample.service import get_samples


def _research_method_export_info(method: ResearchMethod) -> ResearchMethodExportInfo:
    """Собрать ResearchMethodExportInfo из ORM-метода."""
    groups: list[ResearchMethodGroupExportInfo] = []
    if method.groups:
        for group in method.groups:
            groups.append(ResearchMethodGroupExportInfo(id=group.id, name=group.name))

    return ResearchMethodExportInfo(
        id=method.id,
        name=method.name,
        unit=method.unit,
        sort_order=method.sort_order,
        is_group_member=bool(method.is_group_member),
        groups=groups,
        input_data=method.input_data,
    )


async def _load_research_methods_map(db: AsyncSession, method_ids: list[int]) -> dict[int, ResearchMethod]:
    """Загрузить словарь методов исследования по списку ID."""
    if not method_ids:
        return {}

    methods = await research_repo.get_research_methods_by_ids(db, method_ids, include_deleted=True)
    return {method.id: method for method in methods}


def _method_display_name(method: ResearchMethod) -> str:
    """Собрать отображаемое имя методики для экспорта."""
    base_name = method.name or ""
    lower_name = base_name.lower()

    if "фракционный состав" in lower_name:
        return re.sub(r"\s*\([^)]*\)\s*$", "", base_name).strip()

    if method.is_group_member and method.groups:
        group_name = method.groups[0].name if method.groups else ""
        if group_name:
            if group_name == "Вязкость кинематическая":
                return f"{group_name} ({base_name.lower()})"
            return group_name

    return base_name


def _calculation_sort_key(calc: SampleExportCalculation, methods_map: dict[int, ResearchMethod]) -> tuple[int, str]:
    """Вернуть ключ сортировки расчёта в экспорте проб."""
    method = methods_map.get(calc.research_method_id)
    if not method:
        return (10**9, "")

    sort_order = method.sort_order if method.sort_order is not None else 10**9
    return (sort_order, _method_display_name(method))


def _sample_to_export_item(sample: SampleResponse, calculations: list[SampleExportCalculation]) -> SampleExportItem:
    """Собрать элемент экспорта из SampleResponse."""
    return SampleExportItem.model_validate(sample).model_copy(update={"calculations": calculations})


async def get_samples_export_data(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    search: str | None = None,
    search_sampling_location: str | None = None,
    search_protocols: str | None = None,
    search_added_by: str | None = None,
    sample_type: str | None = None,
    sample_types: list[str] | None = None,
    test_object: str | None = None,
    test_objects: list[str] | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
    sampling_date_from: pendulum.DateTime | None = None,
    sampling_date_to: pendulum.DateTime | None = None,
    receiving_date_from: pendulum.DateTime | None = None,
    receiving_date_to: pendulum.DateTime | None = None,
    created_at_from: pendulum.DateTime | None = None,
    created_at_to: pendulum.DateTime | None = None,
) -> tuple[list[SampleExportItem], int]:
    """Собрать данные проб для экспорта: все записи по фильтрам и сортировке, с расчётами."""
    samples, total = await get_samples(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        page=None,
        page_size=None,
        search=search,
        search_sampling_location=search_sampling_location,
        search_protocols=search_protocols,
        search_added_by=search_added_by,
        sample_type=sample_type,
        sample_types=sample_types,
        test_object=test_object,
        test_objects=test_objects,
        sort_by=sort_by,
        sort_order=sort_order,
        sampling_date_from=sampling_date_from,
        sampling_date_to=sampling_date_to,
        receiving_date_from=receiving_date_from,
        receiving_date_to=receiving_date_to,
        created_at_from=created_at_from,
        created_at_to=created_at_to,
    )

    if not samples:
        raise DomainValidationError("Нет данных для экспорта по выбранным фильтрам")

    sample_ids = [sample.id for sample in samples]
    calculations = await get_calculations_by_sample(db, sample_ids=sample_ids)
    method_ids = list({calc.research_method_id for calc in calculations})
    methods_map = await _load_research_methods_map(db, method_ids)

    calcs_by_sample: dict[int, list[SampleExportCalculation]] = defaultdict(list)
    for calc in calculations:
        method = methods_map.get(calc.research_method_id)
        method_info = _research_method_export_info(method) if method else None

        calcs_by_sample[calc.sample_id].append(
            SampleExportCalculation(
                id=calc.id,
                research_method_id=calc.research_method_id,
                input_data=calc.input_data or {},
                result=calc.result,
                measurement_error=calc.measurement_error,
                unit=calc.unit,
                research_method=method_info,
            )
        )

    for sample_id in calcs_by_sample:
        calcs_by_sample[sample_id].sort(key=lambda item: _calculation_sort_key(item, methods_map))

    items = [_sample_to_export_item(sample, calcs_by_sample.get(sample.id, [])) for sample in samples]

    return items, total
