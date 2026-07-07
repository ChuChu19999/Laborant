from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from core.auth_decorators import IsAuthenticated
from core.database import get_db
from core.exceptions import NotFoundError
from schemas.laboratory import (
    BranchCreate,
    BranchResponse,
    BranchUpdate,
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    LaboratoryCreate,
    LaboratoryResponse,
    LaboratoryUpdate,
    SamplingLocationCreate,
    SamplingLocationResponse,
    SamplingLocationUpdate,
    WellModeCreate,
    WellModeResponse,
    WellModeUpdate,
)
from schemas.pagination import PaginatedResponse
from services.laboratory import (
    build_department_response,
    build_sampling_location_response,
    build_well_mode_response,
)
from services.laboratory import create_branch as create_branch_service
from services.laboratory import create_department as create_department_service
from services.laboratory import create_laboratory as create_laboratory_service
from services.laboratory import (
    create_sampling_location as create_sampling_location_service,
)
from services.laboratory import create_well_mode as create_well_mode_service
from services.laboratory import delete_branch as delete_branch_service
from services.laboratory import delete_department as delete_department_service
from services.laboratory import delete_laboratory as delete_laboratory_service
from services.laboratory import (
    delete_sampling_location as delete_sampling_location_service,
)
from services.laboratory import delete_well_mode as delete_well_mode_service
from services.laboratory import (
    get_branches,
    get_departments,
    get_laboratories,
    get_laboratory_by_id,
    get_sampling_location_response_data,
    get_sampling_locations,
    get_well_mode_response_data,
    get_well_modes,
)
from services.laboratory import update_branch as update_branch_service
from services.laboratory import update_department as update_department_service
from services.laboratory import update_laboratory as update_laboratory_service
from services.laboratory import (
    update_sampling_location as update_sampling_location_service,
)
from services.laboratory import update_well_mode as update_well_mode_service

router = APIRouter()


@router.get(
    "/laboratories/",
    response_model=PaginatedResponse[LaboratoryResponse],
    summary="Получение списка лабораторий",
    description=(
        "Возвращает список лабораторий с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает поиск и сортировку."
    ),
    responses={200: {"description": "Список лабораторий успешно получен"}},
)
# @IsAuthenticated
async def list_laboratories(
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает список лабораторий с пагинацией или без."""
    laboratories, total, total_pages = await get_laboratories(
        db,
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    items = []
    for lab in laboratories:
        lab_dict = LaboratoryResponse.model_validate(lab).model_dump()
        lab_dict["departments_count"] = len(
            [d for d in lab.departments if d.deleted_at is None]
        )
        items.append(LaboratoryResponse(**lab_dict))

    return PaginatedResponse(
        items=items,
        total=total,
        page=page if page is not None else 1,
        page_size=page_size if page_size is not None else total,
        total_pages=total_pages,
    )


@router.post(
    "/laboratories/",
    response_model=LaboratoryResponse,
    status_code=201,
    summary="Добавление новой лаборатории",
    description="Добавляет новую лабораторию на основе переданных данных.",
    responses={
        201: {"description": "Лаборатория успешно добавлена"},
        400: {"description": "Некорректные данные для добавления лаборатории"},
    },
)
# @IsAuthenticated
async def create_laboratory(
    laboratory_data: LaboratoryCreate,
    db: AsyncSession = Depends(get_db),
):
    """Добавляет новую лабораторию на основе переданных данных."""
    laboratory = await create_laboratory_service(db, laboratory_data)
    return LaboratoryResponse.model_validate(laboratory)


@router.get(
    "/laboratories/sampling-locations/",
    response_model=list[SamplingLocationResponse],
    summary="Получение списка мест отбора проб",
    description=(
        "Возвращает список мест отбора проб. "
        "Поддерживает фильтрацию по филиалам, поиск и сортировку."
    ),
    responses={200: {"description": "Список мест отбора проб успешно получен"}},
)
# @IsAuthenticated
async def list_sampling_locations(
    branch_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает список мест отбора проб."""
    sampling_locations = await get_sampling_locations(
        db,
        branch_id=branch_id,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return [build_sampling_location_response(loc) for loc in sampling_locations]


@router.post(
    "/laboratories/sampling-locations/",
    response_model=SamplingLocationResponse,
    status_code=201,
    summary="Добавление нового места отбора проб",
    description="Добавляет новое место отбора проб на основе переданных данных.",
    responses={
        201: {"description": "Место отбора проб успешно добавлено"},
        400: {"description": "Некорректные данные для добавления места отбора проб"},
    },
)
# @IsAuthenticated
async def create_sampling_location(
    sampling_location_data: SamplingLocationCreate,
    db: AsyncSession = Depends(get_db),
):
    """Добавляет новое место отбора проб на основе переданных данных."""
    sampling_location = await create_sampling_location_service(
        db, sampling_location_data
    )
    return await get_sampling_location_response_data(db, sampling_location.id)


@router.get(
    "/laboratories/sampling-locations/{sampling_location_id}/",
    response_model=SamplingLocationResponse,
    summary="Получение места отбора проб по ID",
    description="Возвращает информацию о месте отбора проб по его идентификатору.",
    responses={
        200: {"description": "Место отбора проб успешно получено"},
        404: {"description": "Место отбора проб не найдено"},
    },
)
# @IsAuthenticated
async def get_sampling_location(
    sampling_location_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Возвращает информацию о месте отбора проб по его идентификатору."""
    return await get_sampling_location_response_data(db, sampling_location_id)


@router.patch(
    "/laboratories/sampling-locations/{sampling_location_id}/",
    response_model=SamplingLocationResponse,
    summary="Обновление места отбора проб",
    description="Обновляет существующее место отбора проб.",
    responses={
        200: {"description": "Место отбора проб успешно обновлено"},
        404: {"description": "Место отбора проб не найдено"},
    },
)
# @IsAuthenticated
async def update_sampling_location(
    sampling_location_id: int,
    sampling_location_data: SamplingLocationUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Обновляет существующее место отбора проб."""
    await update_sampling_location_service(
        db, sampling_location_id, sampling_location_data
    )
    return await get_sampling_location_response_data(db, sampling_location_id)


@router.delete(
    "/laboratories/sampling-locations/{sampling_location_id}/",
    status_code=204,
    summary="Удаление места отбора проб",
    description="Выполняет мягкое удаление места отбора проб.",
    responses={
        204: {"description": "Место отбора проб успешно удалено"},
        404: {"description": "Место отбора проб не найдено"},
    },
)
# @IsAuthenticated
async def delete_sampling_location(
    sampling_location_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Выполняет мягкое удаление места отбора проб."""
    await delete_sampling_location_service(db, sampling_location_id)


@router.get(
    "/laboratories/well-modes/",
    response_model=list[WellModeResponse],
    summary="Получение списка режимов скважин",
    description=(
        "Возвращает список режимов скважин. "
        "Поддерживает фильтрацию по филиалам, поиск и сортировку."
    ),
    responses={200: {"description": "Список режимов скважин успешно получен"}},
)
# @IsAuthenticated
async def list_well_modes(
    branch_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает список режимов скважин."""
    well_modes = await get_well_modes(
        db,
        branch_id=branch_id,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return [build_well_mode_response(mode) for mode in well_modes]


@router.post(
    "/laboratories/well-modes/",
    response_model=WellModeResponse,
    status_code=201,
    summary="Добавление нового режима скважины",
    description="Добавляет новый режим скважины на основе переданных данных.",
    responses={
        201: {"description": "Режим скважины успешно добавлен"},
        400: {"description": "Некорректные данные для добавления режима скважины"},
    },
)
# @IsAuthenticated
async def create_well_mode(
    well_mode_data: WellModeCreate,
    db: AsyncSession = Depends(get_db),
):
    """Добавляет новый режим скважины на основе переданных данных."""
    well_mode = await create_well_mode_service(db, well_mode_data)
    return await get_well_mode_response_data(db, well_mode.id)


@router.get(
    "/laboratories/well-modes/{well_mode_id}/",
    response_model=WellModeResponse,
    summary="Получение режима скважины по ID",
    description="Возвращает информацию о режиме скважины по его идентификатору.",
    responses={
        200: {"description": "Режим скважины успешно получен"},
        404: {"description": "Режим скважины не найден"},
    },
)
# @IsAuthenticated
async def get_well_mode(
    well_mode_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Возвращает информацию о режиме скважины по его идентификатору."""
    return await get_well_mode_response_data(db, well_mode_id)


@router.patch(
    "/laboratories/well-modes/{well_mode_id}/",
    response_model=WellModeResponse,
    summary="Обновление режима скважины",
    description="Обновляет существующий режим скважины.",
    responses={
        200: {"description": "Режим скважины успешно обновлен"},
        404: {"description": "Режим скважины не найден"},
    },
)
# @IsAuthenticated
async def update_well_mode(
    well_mode_id: int,
    well_mode_data: WellModeUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Обновляет существующий режим скважины."""
    await update_well_mode_service(db, well_mode_id, well_mode_data)
    return await get_well_mode_response_data(db, well_mode_id)


@router.delete(
    "/laboratories/well-modes/{well_mode_id}/",
    status_code=204,
    summary="Удаление режима скважины",
    description="Выполняет мягкое удаление режима скважины.",
    responses={
        204: {"description": "Режим скважины успешно удален"},
        404: {"description": "Режим скважины не найден"},
    },
)
# @IsAuthenticated
async def delete_well_mode(
    well_mode_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Выполняет мягкое удаление режима скважины."""
    await delete_well_mode_service(db, well_mode_id)


@router.get(
    "/laboratories/{laboratory_id}/",
    response_model=LaboratoryResponse,
    summary="Получение лаборатории по ID",
    description="Возвращает информацию о лаборатории по ее идентификатору.",
    responses={
        200: {"description": "Лаборатория успешно получена"},
        404: {"description": "Лаборатория не найдена"},
    },
)
# @IsAuthenticated
async def get_laboratory(
    laboratory_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Возвращает информацию о лаборатории по ее идентификатору."""
    laboratory = await get_laboratory_by_id(db, laboratory_id)
    if not laboratory:
        raise NotFoundError("Лаборатория не найдена")
    return LaboratoryResponse.model_validate(laboratory)


@router.patch(
    "/laboratories/{laboratory_id}/",
    response_model=LaboratoryResponse,
    summary="Обновление лаборатории",
    description="Обновляет существующую лабораторию.",
    responses={
        200: {"description": "Лаборатория успешно обновлена"},
        404: {"description": "Лаборатория не найдена"},
    },
)
# @IsAuthenticated
async def update_laboratory(
    laboratory_id: int,
    laboratory_data: LaboratoryUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Обновляет существующую лабораторию."""
    laboratory = await update_laboratory_service(db, laboratory_id, laboratory_data)
    return LaboratoryResponse.model_validate(laboratory)


@router.delete(
    "/laboratories/{laboratory_id}/",
    status_code=204,
    summary="Удаление лаборатории",
    description="Выполняет мягкое удаление лаборатории.",
    responses={
        204: {"description": "Лаборатория успешно удалена"},
        404: {"description": "Лаборатория не найдена"},
    },
)
# @IsAuthenticated
async def delete_laboratory(
    laboratory_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Выполняет мягкое удаление лаборатории."""
    await delete_laboratory_service(db, laboratory_id)


@router.get(
    "/departments/",
    response_model=PaginatedResponse[DepartmentResponse],
    summary="Получение списка подразделений",
    description=(
        "Возвращает список подразделений с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает фильтрацию по лабораториям, поиск и сортировку."
    ),
    responses={200: {"description": "Список подразделений успешно получен"}},
)
# @IsAuthenticated
async def list_departments(
    laboratory_id: Optional[int] = Query(None),
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает список подразделений с пагинацией или без."""
    departments, total, total_pages = await get_departments(
        db,
        laboratory_id=laboratory_id,
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    items = [build_department_response(dept) for dept in departments]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page if page is not None else 1,
        page_size=page_size if page_size is not None else total,
        total_pages=total_pages,
    )


@router.get(
    "/departments/by-laboratory/",
    response_model=list[DepartmentResponse],
    summary="Получение подразделений по лаборатории",
    description="Возвращает список подразделений для указанной лаборатории.",
    responses={200: {"description": "Список подразделений успешно получен"}},
)
# @IsAuthenticated
async def get_departments_by_laboratory(
    laboratory_id: int = Query(..., description="ID лаборатории"),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает список подразделений для указанной лаборатории."""
    departments, _, _ = await get_departments(db, laboratory_id=laboratory_id)
    items = [build_department_response(dept) for dept in departments]
    return items


@router.post(
    "/departments/",
    response_model=DepartmentResponse,
    status_code=201,
    summary="Добавление нового подразделения",
    description="Добавляет новое подразделение на основе переданных данных.",
    responses={
        201: {"description": "Подразделение успешно добавлено"},
        400: {"description": "Некорректные данные для добавления подразделения"},
    },
)
# @IsAuthenticated
async def create_department(
    department_data: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
):
    """Добавляет новое подразделение на основе переданных данных."""
    department = await create_department_service(db, department_data)
    return DepartmentResponse.model_validate(department)


@router.patch(
    "/departments/{department_id}/",
    response_model=DepartmentResponse,
    summary="Обновление подразделения",
    description="Обновляет существующее подразделение.",
    responses={
        200: {"description": "Подразделение успешно обновлено"},
        404: {"description": "Подразделение не найдено"},
    },
)
# @IsAuthenticated
async def update_department(
    department_id: int,
    department_data: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Обновляет существующее подразделение."""
    department = await update_department_service(db, department_id, department_data)
    return DepartmentResponse.model_validate(department)


@router.delete(
    "/departments/{department_id}/",
    status_code=204,
    summary="Удаление подразделения",
    description="Выполняет мягкое удаление подразделения.",
    responses={
        204: {"description": "Подразделение успешно удалено"},
        404: {"description": "Подразделение не найдено"},
    },
)
# @IsAuthenticated
async def delete_department(
    department_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Выполняет мягкое удаление подразделения."""
    await delete_department_service(db, department_id)


@router.get(
    "/branches/",
    response_model=list[BranchResponse],
    summary="Получение списка филиалов",
    description=(
        "Возвращает список филиалов. "
        "Поддерживает фильтрацию по лабораториям и подразделениям, поиск и сортировку."
    ),
    responses={200: {"description": "Список филиалов успешно получен"}},
)
# @IsAuthenticated
async def list_branches(
    laboratory_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает список филиалов."""
    branches = await get_branches(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return [BranchResponse.model_validate(branch) for branch in branches]


@router.post(
    "/branches/",
    response_model=BranchResponse,
    status_code=201,
    summary="Добавление нового филиала",
    description="Добавляет новый филиал на основе переданных данных.",
    responses={
        201: {"description": "Филиал успешно добавлен"},
        400: {"description": "Некорректные данные для добавления филиала"},
    },
)
# @IsAuthenticated
async def create_branch(
    branch_data: BranchCreate,
    db: AsyncSession = Depends(get_db),
):
    """Добавляет новый филиал на основе переданных данных."""
    branch = await create_branch_service(db, branch_data)
    return BranchResponse.model_validate(branch)


@router.patch(
    "/branches/{branch_id}/",
    response_model=BranchResponse,
    summary="Обновление филиала",
    description="Обновляет существующий филиал.",
    responses={
        200: {"description": "Филиал успешно обновлен"},
        404: {"description": "Филиал не найден"},
    },
)
# @IsAuthenticated
async def update_branch(
    branch_id: int,
    branch_data: BranchUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Обновляет существующий филиал."""
    branch = await update_branch_service(db, branch_id, branch_data)
    return BranchResponse.model_validate(branch)


@router.delete(
    "/branches/{branch_id}/",
    status_code=204,
    summary="Удаление филиала",
    description="Выполняет мягкое удаление филиала.",
    responses={
        204: {"description": "Филиал успешно удален"},
        404: {"description": "Филиал не найден"},
    },
)
# @IsAuthenticated
async def delete_branch(
    branch_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Выполняет мягкое удаление филиала."""
    await delete_branch_service(db, branch_id)
