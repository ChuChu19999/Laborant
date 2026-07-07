from __future__ import annotations
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import ConflictError, NotFoundError, ValidationError
from models.laboratory import Branch, Department, Laboratory, SamplingLocation, WellMode
from repositories import laboratory as laboratory_repo
from repositories.base import flush_entity
from schemas.laboratory import (
    BranchCreate,
    BranchUpdate,
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    LaboratoryCreate,
    LaboratoryUpdate,
    SamplingLocationCreate,
    SamplingLocationResponse,
    SamplingLocationUpdate,
    WellModeCreate,
    WellModeResponse,
    WellModeUpdate,
)
from utils.pagination import calculate_total_pages


async def get_laboratory_by_id(
    db: AsyncSession, laboratory_id: int, include_deleted: bool = False
) -> Optional[Laboratory]:
    """Получить лабораторию по ID."""
    return await laboratory_repo.get_laboratory_by_id(
        db, laboratory_id, include_deleted
    )


async def get_laboratories(
    db: AsyncSession,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[list[Laboratory], int, int]:
    """Получить список лабораторий."""
    laboratories, total = await laboratory_repo.get_laboratories(
        db, page, page_size, search, sort_by, sort_order
    )

    if page is not None and page_size is not None:
        total_pages = calculate_total_pages(total, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    return laboratories, total, total_pages


async def create_laboratory(
    db: AsyncSession, laboratory_data: LaboratoryCreate
) -> Laboratory:
    """Создать лабораторию."""
    if await laboratory_repo.exists_laboratory_by_name(db, laboratory_data.name):
        raise ConflictError("Лаборатория с таким названием уже существует")

    laboratory = Laboratory(
        name=laboratory_data.name.strip(),
        full_name=laboratory_data.full_name.strip(),
        laboratory_location=(
            laboratory_data.laboratory_location.strip()
            if laboratory_data.laboratory_location
            else None
        ),
    )
    return await laboratory_repo.add_laboratory(db, laboratory)


async def update_laboratory(
    db: AsyncSession, laboratory_id: int, laboratory_data: LaboratoryUpdate
) -> Laboratory:
    """Обновить лабораторию."""
    laboratory = await get_laboratory_by_id(db, laboratory_id)
    if not laboratory:
        raise NotFoundError("Лаборатория не найдена")

    if laboratory_data.name is not None:
        if await laboratory_repo.exists_laboratory_by_name(
            db, laboratory_data.name, exclude_id=laboratory_id
        ):
            raise ConflictError("Лаборатория с таким названием уже существует")
        laboratory.name = laboratory_data.name.strip()

    if laboratory_data.full_name is not None:
        laboratory.full_name = laboratory_data.full_name.strip()

    if laboratory_data.laboratory_location is not None:
        laboratory.laboratory_location = laboratory_data.laboratory_location.strip()

    await flush_entity(db)
    return laboratory


async def delete_laboratory(db: AsyncSession, laboratory_id: int) -> None:
    """Удалить лабораторию (мягкое удаление)."""
    laboratory = await laboratory_repo.get_laboratory_with_departments_for_delete(
        db, laboratory_id
    )

    if not laboratory:
        raise NotFoundError("Лаборатория не найдена")

    for department in laboratory.departments:
        if department.deleted_at is None:
            department.soft_delete()

    laboratory.soft_delete()
    await flush_entity(db)


async def get_department_by_id(
    db: AsyncSession, department_id: int, include_deleted: bool = False
) -> Optional[Department]:
    """Получить подразделение по ID."""
    return await laboratory_repo.get_department_by_id(
        db, department_id, include_deleted
    )


def build_department_response(dept: Department) -> DepartmentResponse:
    """Собрать ответ API по подразделению с наименованием лаборатории."""
    dept_dict = DepartmentResponse.model_validate(dept).model_dump()
    if dept.laboratory:
        dept_dict["laboratory_name"] = dept.laboratory.name
    return DepartmentResponse(**dept_dict)


async def get_departments(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[list[Department], int, int]:
    """Получить список подразделений."""
    departments, total = await laboratory_repo.get_departments(
        db, laboratory_id, page, page_size, search, sort_by, sort_order
    )

    if page is not None and page_size is not None:
        total_pages = calculate_total_pages(total, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    return departments, total, total_pages


async def create_department(
    db: AsyncSession, department_data: DepartmentCreate
) -> Department:
    """Создать подразделение."""
    laboratory = await get_laboratory_by_id(db, department_data.laboratory_id)
    if not laboratory:
        raise NotFoundError("Лаборатория не найдена")

    if await laboratory_repo.exists_department_by_name_and_laboratory(
        db, department_data.laboratory_id, department_data.name
    ):
        raise ConflictError(
            "Подразделение с таким названием уже существует для данной лаборатории"
        )

    department = Department(
        laboratory_id=department_data.laboratory_id,
        name=department_data.name.strip(),
        laboratory_location=department_data.laboratory_location.strip(),
    )
    return await laboratory_repo.add_department(db, department)


async def update_department(
    db: AsyncSession, department_id: int, department_data: DepartmentUpdate
) -> Department:
    """Обновить подразделение."""
    department = await get_department_by_id(db, department_id)
    if not department:
        raise NotFoundError("Подразделение не найдено")

    if department_data.name is not None:
        if await laboratory_repo.exists_department_by_name_and_laboratory(
            db,
            department.laboratory_id,
            department_data.name,
            exclude_id=department_id,
        ):
            raise ConflictError(
                "Подразделение с таким названием уже существует для данной лаборатории"
            )
        department.name = department_data.name.strip()

    if department_data.laboratory_location is not None:
        department.laboratory_location = department_data.laboratory_location.strip()

    await flush_entity(db)
    return department


async def delete_department(db: AsyncSession, department_id: int) -> None:
    """Удалить подразделение (мягкое удаление)."""
    department = await get_department_by_id(db, department_id)
    if not department:
        raise NotFoundError("Подразделение не найдено")

    department.soft_delete()
    await flush_entity(db)


async def get_branch_by_id(
    db: AsyncSession, branch_id: int, include_deleted: bool = False
) -> Optional[Branch]:
    """Получить филиал по ID."""
    return await laboratory_repo.get_branch_by_id(db, branch_id, include_deleted)


async def get_branches(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> list[Branch]:
    """Получить список филиалов."""
    return await laboratory_repo.get_branches(
        db, laboratory_id, department_id, search, sort_by, sort_order
    )


async def create_branch(db: AsyncSession, branch_data: BranchCreate) -> Branch:
    """Создать филиал."""
    laboratory = await get_laboratory_by_id(db, branch_data.laboratory_id)
    if not laboratory:
        raise NotFoundError("Лаборатория не найдена")

    if branch_data.department_id:
        department = await get_department_by_id(db, branch_data.department_id)
        if not department:
            raise NotFoundError("Подразделение не найдено")
        if department.laboratory_id != branch_data.laboratory_id:
            raise ValidationError(
                "Подразделение должно принадлежать выбранной лаборатории"
            )

    branch = Branch(
        name=branch_data.name.strip(),
        phone=branch_data.phone.strip() if branch_data.phone else None,
        laboratory_id=branch_data.laboratory_id,
        department_id=branch_data.department_id,
    )
    return await laboratory_repo.add_branch(db, branch)


async def update_branch(
    db: AsyncSession, branch_id: int, branch_data: BranchUpdate
) -> Branch:
    """Обновить филиал."""
    branch = await get_branch_by_id(db, branch_id)
    if not branch:
        raise NotFoundError("Филиал не найден")

    if branch_data.name is not None:
        branch.name = branch_data.name.strip()
    if branch_data.phone is not None:
        branch.phone = branch_data.phone.strip() if branch_data.phone else None

    await flush_entity(db)
    return branch


async def delete_branch(db: AsyncSession, branch_id: int) -> None:
    """Удалить филиал (мягкое удаление)."""
    branch = await laboratory_repo.get_branch_with_sampling_locations_for_delete(
        db, branch_id
    )

    if not branch:
        raise NotFoundError("Филиал не найден")

    for sampling_location in branch.sampling_locations:
        if sampling_location.deleted_at is None:
            sampling_location.soft_delete()

    branch.soft_delete()
    await flush_entity(db)


async def get_sampling_location_by_id(
    db: AsyncSession, sampling_location_id: int, include_deleted: bool = False
) -> Optional[SamplingLocation]:
    """Получить место отбора пробы по ID."""
    return await laboratory_repo.get_sampling_location_by_id(
        db, sampling_location_id, include_deleted
    )


async def get_sampling_locations(
    db: AsyncSession,
    branch_id: Optional[int] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> list[SamplingLocation]:
    """Получить список мест отбора проб."""
    return await laboratory_repo.get_sampling_locations(
        db, branch_id, search, sort_by, sort_order
    )


async def create_sampling_location(
    db: AsyncSession, sampling_location_data: SamplingLocationCreate
) -> SamplingLocation:
    """Создать место отбора пробы."""
    branch = await get_branch_by_id(db, sampling_location_data.branch_id)
    if not branch:
        raise NotFoundError("Филиал не найден")

    if await laboratory_repo.exists_sampling_location_by_name_and_branch(
        db, sampling_location_data.branch_id, sampling_location_data.name
    ):
        raise ConflictError(
            "Место отбора пробы с таким названием уже существует для данного филиала"
        )

    sampling_location = SamplingLocation(
        branch_id=sampling_location_data.branch_id,
        name=sampling_location_data.name.strip(),
    )
    return await laboratory_repo.add_sampling_location(db, sampling_location)


async def update_sampling_location(
    db: AsyncSession,
    sampling_location_id: int,
    sampling_location_data: SamplingLocationUpdate,
) -> SamplingLocation:
    """Обновить место отбора пробы."""
    sampling_location = await get_sampling_location_by_id(db, sampling_location_id)
    if not sampling_location:
        raise NotFoundError("Место отбора пробы не найдено")

    if sampling_location_data.name is not None:
        if await laboratory_repo.exists_sampling_location_by_name_and_branch(
            db,
            sampling_location.branch_id,
            sampling_location_data.name,
            exclude_id=sampling_location_id,
        ):
            raise ConflictError(
                "Место отбора пробы с таким названием уже существует для данного филиала"
            )
        sampling_location.name = sampling_location_data.name.strip()

    await flush_entity(db)
    return sampling_location


async def delete_sampling_location(db: AsyncSession, sampling_location_id: int) -> None:
    """Удалить место отбора пробы (мягкое удаление)."""
    sampling_location = await get_sampling_location_by_id(db, sampling_location_id)
    if not sampling_location:
        raise NotFoundError("Место отбора пробы не найдено")

    sampling_location.soft_delete()
    await flush_entity(db)


async def get_well_mode_by_id(
    db: AsyncSession, well_mode_id: int, include_deleted: bool = False
) -> Optional[WellMode]:
    """Получить режим скважины по ID."""
    return await laboratory_repo.get_well_mode_by_id(db, well_mode_id, include_deleted)


async def get_well_modes(
    db: AsyncSession,
    branch_id: Optional[int] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> list[WellMode]:
    """Получить список режимов скважин."""
    return await laboratory_repo.get_well_modes(
        db, branch_id, search, sort_by, sort_order
    )


async def create_well_mode(
    db: AsyncSession, well_mode_data: WellModeCreate
) -> WellMode:
    """Создать режим скважины."""
    branch = await get_branch_by_id(db, well_mode_data.branch_id)
    if not branch:
        raise NotFoundError("Филиал не найден")

    if await laboratory_repo.exists_well_mode_by_name_and_branch(
        db, well_mode_data.branch_id, well_mode_data.name
    ):
        raise ConflictError(
            "Режим скважины с таким названием уже существует для данного филиала"
        )

    well_mode = WellMode(
        branch_id=well_mode_data.branch_id,
        name=well_mode_data.name.strip(),
    )
    return await laboratory_repo.add_well_mode(db, well_mode)


async def update_well_mode(
    db: AsyncSession,
    well_mode_id: int,
    well_mode_data: WellModeUpdate,
) -> WellMode:
    """Обновить режим скважины."""
    well_mode = await get_well_mode_by_id(db, well_mode_id)
    if not well_mode:
        raise NotFoundError("Режим скважины не найден")

    if well_mode_data.name is not None:
        if await laboratory_repo.exists_well_mode_by_name_and_branch(
            db,
            well_mode.branch_id,
            well_mode_data.name,
            exclude_id=well_mode_id,
        ):
            raise ConflictError(
                "Режим скважины с таким названием уже существует для данного филиала"
            )
        well_mode.name = well_mode_data.name.strip()

    await flush_entity(db)
    return well_mode


async def delete_well_mode(db: AsyncSession, well_mode_id: int) -> None:
    """Удалить режим скважины (мягкое удаление)."""
    well_mode = await get_well_mode_by_id(db, well_mode_id)
    if not well_mode:
        raise NotFoundError("Режим скважины не найден")

    well_mode.soft_delete()
    await flush_entity(db)


def build_sampling_location_response(
    sampling_location: SamplingLocation,
) -> SamplingLocationResponse:
    """Собрать ответ API по месту отбора с данными филиала."""
    loc_dict = SamplingLocationResponse.model_validate(sampling_location).model_dump()
    if sampling_location.branch:
        loc_dict["branch_name"] = sampling_location.branch.name
        loc_dict["branch_phone"] = sampling_location.branch.phone
    return SamplingLocationResponse(**loc_dict)


async def get_sampling_location_response_data(
    db: AsyncSession, sampling_location_id: int
) -> SamplingLocationResponse:
    """Получить место отбора с данными для ответа API."""
    sampling_location = await laboratory_repo.get_sampling_location_by_id(
        db, sampling_location_id
    )
    if not sampling_location:
        raise NotFoundError("Место отбора проб не найдено")
    return build_sampling_location_response(sampling_location)


def build_well_mode_response(well_mode: WellMode) -> WellModeResponse:
    """Собрать ответ API по режиму скважины с наименованием филиала."""
    mode_dict = WellModeResponse.model_validate(well_mode).model_dump()
    if well_mode.branch:
        mode_dict["branch_name"] = well_mode.branch.name
    return WellModeResponse(**mode_dict)


async def get_well_mode_response_data(
    db: AsyncSession, well_mode_id: int
) -> WellModeResponse:
    """Получить режим скважины с данными для ответа API."""
    well_mode = await laboratory_repo.get_well_mode_by_id(db, well_mode_id)
    if not well_mode:
        raise NotFoundError("Режим скважины не найден")
    return build_well_mode_response(well_mode)
