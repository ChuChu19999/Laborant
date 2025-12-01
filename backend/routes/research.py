from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from core.database import get_db
from core.exceptions import NotFoundError
from core.security import IsAuthenticated
from models.research import ResearchMethod, ResearchMethodGroup
from schemas.pagination import PaginatedResponse
from schemas.research import (
    ResearchMethodCreate,
    ResearchMethodGroupCreate,
    ResearchMethodGroupResponse,
    ResearchMethodGroupUpdate,
    ResearchMethodResponse,
    ResearchMethodSortOrderUpdate,
    ResearchMethodUpdate,
)
from services.calculation import get_calculations
from services.research import (
    create_research_method,
    create_research_method_group,
    delete_research_method,
    delete_research_method_group,
    get_research_method_by_id,
    get_research_method_group_by_id,
    get_research_method_groups,
    get_research_methods,
    update_research_method,
    update_research_method_group,
    update_research_method_sort_order,
)
from services.sample import get_sample_by_id

router = APIRouter()


@router.get(
    "/research-methods/",
    response_model=PaginatedResponse[ResearchMethodResponse],
    summary="Получение списка методов исследования",
    description=(
        "Возвращает список методов исследования с пагинацией. "
        "Поддерживает фильтрацию по лабораториям, подразделениям и типу округления, поиск и сортировку."
    ),
    responses={200: {"description": "Список методов исследования успешно получен"}},
)
# @IsAuthenticated
async def list_research_methods(
    laboratory_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    rounding_type: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
    db: AsyncSession = Depends(get_db),
):
    """
    Получить список методов исследования с пагинацией.

    Возвращает список методов исследования с возможностью фильтрации и сортировки.
    """
    methods, total, total_pages = await get_research_methods(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        page=page,
        page_size=page_size,
        search=search,
        rounding_type=rounding_type,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    items = []
    for method in methods:
        method_dict = ResearchMethodResponse.model_validate(method).model_dump()
        if hasattr(method, "groups"):
            method_dict["groups"] = [
                {"id": g.id, "name": g.name} for g in method.groups
            ]
        items.append(ResearchMethodResponse(**method_dict))

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "/research-methods/",
    response_model=ResearchMethodResponse,
    status_code=201,
    summary="Создание нового метода исследования",
    description="Создает новый метод исследования на основе переданных данных.",
    responses={
        201: {"description": "Метод исследования успешно создан"},
        400: {"description": "Некорректные данные для создания метода исследования"},
    },
)
# @IsAuthenticated
async def create_research_method_endpoint(
    method_data: ResearchMethodCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Создать метод исследования.

    Создает новый метод исследования на основе переданных данных.
    """
    method = await create_research_method(db, method_data)
    await db.commit()
    method_dict = ResearchMethodResponse.model_validate(method).model_dump()
    if hasattr(method, "groups"):
        method_dict["groups"] = [{"id": g.id, "name": g.name} for g in method.groups]
    return ResearchMethodResponse(**method_dict)


@router.get(
    "/research-methods/{method_id}/",
    response_model=ResearchMethodResponse,
    summary="Получение метода исследования по ID",
    description="Возвращает информацию о методе исследования по его идентификатору.",
    responses={
        200: {"description": "Метод исследования успешно получен"},
        404: {"description": "Метод исследования не найден"},
    },
)
# @IsAuthenticated
async def get_research_method(
    method_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Получить метод исследования по ID.

    Возвращает полную информацию о методе исследования по его идентификатору.
    """
    method = await get_research_method_by_id(db, method_id)
    if not method:
        raise NotFoundError("Метод исследования не найден")
    method_dict = ResearchMethodResponse.model_validate(method).model_dump()
    if hasattr(method, "groups"):
        method_dict["groups"] = [{"id": g.id, "name": g.name} for g in method.groups]
    return ResearchMethodResponse(**method_dict)


@router.patch(
    "/research-methods/{method_id}/",
    response_model=ResearchMethodResponse,
    summary="Обновление метода исследования",
    description="Обновляет существующий метод исследования. Можно обновить только указанные поля.",
    responses={
        200: {"description": "Метод исследования успешно обновлен"},
        404: {"description": "Метод исследования не найден"},
    },
)
# @IsAuthenticated
async def update_research_method_endpoint(
    method_id: int,
    method_data: ResearchMethodUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Обновить метод исследования.

    Обновляет существующий метод исследования по его идентификатору.
    """
    method = await update_research_method(db, method_id, method_data)
    await db.commit()
    method_dict = ResearchMethodResponse.model_validate(method).model_dump()
    if hasattr(method, "groups"):
        method_dict["groups"] = [{"id": g.id, "name": g.name} for g in method.groups]
    return ResearchMethodResponse(**method_dict)


@router.delete(
    "/research-methods/{method_id}/",
    status_code=204,
    summary="Удаление метода исследования",
    description="Выполняет мягкое удаление метода исследования. Метод помечается как удаленный.",
    responses={
        204: {"description": "Метод исследования успешно удален"},
        404: {"description": "Метод исследования не найден"},
    },
)
# @IsAuthenticated
async def delete_research_method_endpoint(
    method_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Удалить метод исследования (мягкое удаление).

    Выполняет мягкое удаление метода исследования по его идентификатору.
    """
    await delete_research_method(db, method_id)
    await db.commit()


@router.patch(
    "/research-methods/{method_id}/sort-order/",
    response_model=ResearchMethodResponse,
    summary="Изменение порядка сортировки метода исследования",
    description="Изменяет порядок сортировки метода исследования.",
    responses={
        200: {"description": "Порядок сортировки успешно изменен"},
        404: {"description": "Метод исследования не найден"},
    },
)
# @IsAuthenticated
async def update_research_method_sort_order_endpoint(
    method_id: int,
    sort_data: ResearchMethodSortOrderUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Изменить порядок сортировки метода исследования.

    Изменяет порядок сортировки метода исследования по его идентификатору.
    """
    method = await update_research_method_sort_order(db, method_id, sort_data)
    await db.commit()
    method_dict = ResearchMethodResponse.model_validate(method).model_dump()
    if hasattr(method, "groups"):
        method_dict["groups"] = [{"id": g.id, "name": g.name} for g in method.groups]
    return ResearchMethodResponse(**method_dict)


@router.get(
    "/research-method-groups/",
    response_model=PaginatedResponse[ResearchMethodGroupResponse],
    summary="Получение списка групп методов исследования",
    description=(
        "Возвращает список групп методов исследования с пагинацией. "
        "Поддерживает поиск и сортировку."
    ),
    responses={
        200: {"description": "Список групп методов исследования успешно получен"}
    },
)
# @IsAuthenticated
async def list_research_method_groups(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
    db: AsyncSession = Depends(get_db),
):
    """
    Получить список групп методов исследования с пагинацией.

    Возвращает список групп методов исследования с возможностью фильтрации и сортировки.
    """
    groups, total, total_pages = await get_research_method_groups(
        db,
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return PaginatedResponse(
        items=[ResearchMethodGroupResponse.model_validate(group) for group in groups],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "/research-method-groups/",
    response_model=ResearchMethodGroupResponse,
    status_code=201,
    summary="Создание новой группы методов исследования",
    description="Создает новую группу методов исследования на основе переданных данных.",
    responses={
        201: {"description": "Группа методов исследования успешно создана"},
        400: {
            "description": "Некорректные данные для создания группы методов исследования"
        },
    },
)
# @IsAuthenticated
async def create_research_method_group_endpoint(
    group_data: ResearchMethodGroupCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Создать группу методов исследования.

    Создает новую группу методов исследования на основе переданных данных.
    """
    group = await create_research_method_group(db, group_data)
    await db.commit()
    return ResearchMethodGroupResponse.model_validate(group)


@router.get(
    "/research-method-groups/{group_id}/",
    response_model=ResearchMethodGroupResponse,
    summary="Получение группы методов исследования по ID",
    description="Возвращает информацию о группе методов исследования по ее идентификатору.",
    responses={
        200: {"description": "Группа методов исследования успешно получена"},
        404: {"description": "Группа методов исследования не найдена"},
    },
)
# @IsAuthenticated
async def get_research_method_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Получить группу методов исследования по ID.

    Возвращает полную информацию о группе методов исследования по ее идентификатору.
    """
    group = await get_research_method_group_by_id(db, group_id)
    if not group:
        raise NotFoundError("Группа методов исследования не найдена")
    return ResearchMethodGroupResponse.model_validate(group)


@router.patch(
    "/research-method-groups/{group_id}/",
    response_model=ResearchMethodGroupResponse,
    summary="Обновление группы методов исследования",
    description="Обновляет существующую группу методов исследования. Можно обновить только указанные поля.",
    responses={
        200: {"description": "Группа методов исследования успешно обновлена"},
        404: {"description": "Группа методов исследования не найдена"},
    },
)
# @IsAuthenticated
async def update_research_method_group_endpoint(
    group_id: int,
    group_data: ResearchMethodGroupUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Обновить группу методов исследования.

    Обновляет существующую группу методов исследования по ее идентификатору.
    """
    group = await update_research_method_group(db, group_id, group_data)
    await db.commit()
    return ResearchMethodGroupResponse.model_validate(group)


@router.delete(
    "/research-method-groups/{group_id}/",
    status_code=204,
    summary="Удаление группы методов исследования",
    description="Выполняет мягкое удаление группы методов исследования. Группа помечается как удаленная.",
    responses={
        204: {"description": "Группа методов исследования успешно удалена"},
        404: {"description": "Группа методов исследования не найдена"},
    },
)
# @IsAuthenticated
async def delete_research_method_group_endpoint(
    group_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Удалить группу методов исследования (мягкое удаление).

    Выполняет мягкое удаление группы методов исследования по ее идентификатору.
    """
    await delete_research_method_group(db, group_id)
    await db.commit()


@router.get(
    "/research-methods/available/",
    summary="Получение доступных методов исследования",
    description=(
        "Возвращает список доступных методов исследования для указанной лаборатории и подразделения. "
        "Методы возвращаются сгруппированными по группам, если они принадлежат группе. "
        "Если указан sample_id, исключаются методы, уже привязанные к этой пробе."
    ),
    responses={
        200: {"description": "Список доступных методов исследования успешно получен"}
    },
)
# @IsAuthenticated
async def get_available_research_methods(
    laboratory_id: int = Query(..., description="ID лаборатории"),
    department_id: Optional[int] = Query(None, description="ID подразделения"),
    sample_id: Optional[int] = Query(
        None, description="ID пробы (для исключения уже использованных методов)"
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Получить список доступных методов исследования для лаборатории/подразделения.

    Методы возвращаются сгруппированными по группам, если они принадлежат группе.
    Если указан sample_id, исключаются методы, уже привязанные к этой пробе.
    """
    sample = None
    if sample_id:
        sample = await get_sample_by_id(db, sample_id)
        if not sample:
            raise NotFoundError("Проба не найдена")

    query = (
        select(ResearchMethod)
        .where(
            ResearchMethod.laboratory_id == laboratory_id,
            ResearchMethod.deleted_at.is_(None),
        )
        .options(selectinload(ResearchMethod.groups))
    )

    if department_id:
        query = query.where(ResearchMethod.department_id == department_id)

    result = await db.execute(query)
    methods = result.scalars().all()

    if sample_id and sample:
        calculations, _, _ = await get_calculations(
            db, sample_id=sample_id, include_deleted=False, page=1, page_size=1000
        )
        used_method_ids = {calc.research_method_id for calc in calculations}
        methods = [m for m in methods if m.id not in used_method_ids]

        if sample.test_object:
            test_object_lower = sample.test_object.lower()
            filtered_methods = []
            for method in methods:
                if not method.sample_type:
                    continue
                method_sample_types = (
                    method.sample_type
                    if isinstance(method.sample_type, list)
                    else [method.sample_type]
                )
                sample_type = _determine_sample_type(test_object_lower)
                if sample_type and sample_type in method_sample_types:
                    filtered_methods.append(method)
            methods = filtered_methods

    groups = await db.execute(
        select(ResearchMethodGroup).where(ResearchMethodGroup.deleted_at.is_(None))
    )
    groups_list = groups.scalars().all()
    groups_dict = {g.id: g for g in groups_list}

    all_methods = []
    for method in methods:
        if method.groups:
            group = method.groups[0]
            group_entry = next(
                (item for item in all_methods if item.get("group_id") == group.id),
                None,
            )
            if not group_entry:
                group_entry = {
                    "id": f"group_{group.id}",
                    "name": group.name,
                    "is_group": True,
                    "group_id": group.id,
                    "methods": [],
                    "sort_order": method.sort_order or 0,
                }
                all_methods.append(group_entry)
            group_entry["methods"].append(
                {
                    "id": method.id,
                    "name": method.name,
                    "sort_order": method.sort_order or 0,
                    "input_data": method.input_data,
                    "intermediate_data": method.intermediate_data,
                    "unit": method.unit,
                    "equipment_data_default": method.equipment_data_default,
                }
            )
        else:
            all_methods.append(
                {
                    "id": method.id,
                    "name": method.name,
                    "sort_order": method.sort_order or 0,
                    "input_data": method.input_data,
                    "intermediate_data": method.intermediate_data,
                    "unit": method.unit,
                    "equipment_data_default": method.equipment_data_default,
                    "is_group": False,
                }
            )

    all_methods.sort(key=lambda x: (x.get("sort_order", 0), x.get("name", "")))
    for method in all_methods:
        if method.get("is_group"):
            method["methods"].sort(
                key=lambda x: (x.get("sort_order", 0), x.get("name", ""))
            )

    return {"methods": all_methods}


def _determine_sample_type(text: str) -> Optional[str]:
    """Определить тип пробы по тексту test_object."""
    if not text:
        return None
    text_lower = text.lower()
    if "нефть" in text_lower or "нефть калибровочная" in text_lower:
        return "oil"
    elif "дегазированный конденсат" in text_lower:
        return "condensate"
    elif (
        "нефтеконденсатная смесь" in text_lower
        or "oil condensate mixture" in text_lower
    ):
        return "oil_condensate_mixture"
    elif "дизельное топливо" in text_lower or "diesel fuel" in text_lower:
        return "diesel_fuel"
    elif (
        "отработанные нефтепродукты" in text_lower or "spent oil products" in text_lower
    ):
        return "spent_oil_products"
    elif "масло турбинное" in text_lower or "turbine oil" in text_lower:
        return "turbine_oil"
    elif "масло авиационное" in text_lower or "aviation oil" in text_lower:
        return "aviation_oil"
    elif (
        "смесь жидких углеводородов" in text_lower
        or "mixture of liquid hydrocarbons" in text_lower
    ):
        return "liquid_hydrocarbons_mixture"
    elif "ингибитор коррозии" in text_lower or "corrosion inhibitor" in text_lower:
        return "corrosion_inhibitor"
    return None
