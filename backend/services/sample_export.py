import re
from collections import defaultdict
from typing import Any, Dict, List, Optional
import pendulum
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.research import ResearchMethod
from schemas.sample import SampleResponse
from schemas.sample_export import (
    ResearchMethodExportInfo,
    SampleExportCalculation,
    SampleExportItem,
)
from services.calculation import get_calculations_by_sample
from services.protocol import get_protocols_by_sample_ids
from services.sample import get_samples


def _research_method_export_info(method: ResearchMethod) -> ResearchMethodExportInfo:
    groups: List[Dict[str, Any]] = []
    if method.groups:
        for group in method.groups:
            groups.append({"id": group.id, "name": group.name})

    return ResearchMethodExportInfo(
        id=method.id,
        name=method.name,
        unit=method.unit,
        sort_order=method.sort_order,
        is_group_member=bool(method.is_group_member),
        groups=groups,
        input_data=method.input_data,
    )


async def _load_research_methods_map(
    db: AsyncSession, method_ids: List[int]
) -> Dict[int, ResearchMethod]:
    if not method_ids:
        return {}

    result = await db.execute(
        select(ResearchMethod)
        .where(ResearchMethod.id.in_(method_ids))
        .options(selectinload(ResearchMethod.groups))
    )
    methods = result.scalars().all()
    return {method.id: method for method in methods}


def _method_display_name(method: ResearchMethod) -> str:
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


def _calculation_sort_key(
    calc: SampleExportCalculation, methods_map: Dict[int, ResearchMethod]
) -> tuple[int, str]:
    method = methods_map.get(calc.research_method_id)
    if not method:
        return (10**9, "")

    sort_order = method.sort_order if method.sort_order is not None else 10**9
    return (sort_order, _method_display_name(method))


async def get_samples_export_data(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
    search: Optional[str] = None,
    search_sampling_location: Optional[str] = None,
    search_protocols: Optional[str] = None,
    search_added_by: Optional[str] = None,
    sample_type: Optional[str] = None,
    sample_types: Optional[List[str]] = None,
    test_object: Optional[str] = None,
    test_objects: Optional[List[str]] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
    sampling_date_from: Optional[pendulum.DateTime] = None,
    sampling_date_to: Optional[pendulum.DateTime] = None,
    receiving_date_from: Optional[pendulum.DateTime] = None,
    receiving_date_to: Optional[pendulum.DateTime] = None,
    created_at_from: Optional[pendulum.DateTime] = None,
    created_at_to: Optional[pendulum.DateTime] = None,
) -> tuple[List[SampleExportItem], int]:
    """Данные проб для экспорта: все записи по фильтрам и сортировке, с расчетами."""
    samples, total, _ = await get_samples(
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
        return [], total

    sample_ids = [sample.id for sample in samples]
    calculations = await get_calculations_by_sample(db, sample_ids=sample_ids)
    method_ids = list({calc.research_method_id for calc in calculations})
    methods_map = await _load_research_methods_map(db, method_ids)

    calcs_by_sample: Dict[int, List[SampleExportCalculation]] = defaultdict(list)
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
        calcs_by_sample[sample_id].sort(
            key=lambda item: _calculation_sort_key(item, methods_map)
        )

    protocols_by_sample = await get_protocols_by_sample_ids(db, sample_ids)

    items: List[SampleExportItem] = []
    for sample in samples:
        sample_dict = SampleResponse.model_validate(sample).model_dump()
        if hasattr(sample, "laboratory") and sample.laboratory:
            sample_dict["laboratory_name"] = sample.laboratory.name
        if hasattr(sample, "department") and sample.department:
            sample_dict["department_name"] = sample.department.name
        if hasattr(sample, "branch") and sample.branch:
            sample_dict["branch_name"] = sample.branch.name
        if hasattr(sample, "sampling_location") and sample.sampling_location:
            sample_dict["sampling_location_name"] = sample.sampling_location.name
        sample_dict["protocols"] = protocols_by_sample.get(sample.id, [])
        sample_dict["calculations"] = calcs_by_sample.get(sample.id, [])
        items.append(SampleExportItem(**sample_dict))

    return items, total
