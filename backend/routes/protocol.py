from typing import Optional
from urllib.parse import quote
import orjson
from fastapi import APIRouter, Depends, Form, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from core.database import get_db
from core.exceptions import NotFoundError, ValidationError
from core.logger import logger
from core.security import IsAuthenticated
from models.protocol import Protocol, ProtocolTemplate
from schemas.pagination import PaginatedResponse
from schemas.protocol import (
    ProtocolCreate,
    ProtocolResponse,
    ProtocolTemplateCreate,
    ProtocolTemplateResponse,
    ProtocolTemplateUpdate,
    ProtocolUpdate,
)
from schemas.sample import SampleResponse
from services.excel_template import get_excel_styles, save_excel_section
from services.protocol import (
    create_protocol,
    create_protocol_template,
    delete_protocol,
    delete_protocol_template,
    get_protocol_by_id,
    get_protocol_template_by_id,
    get_protocol_templates,
    get_protocols,
    update_protocol,
    update_protocol_template,
)
from services.protocol_generator import generate_protocol_excel
from services.sample import get_sample_by_id
from utils.query_params import parse_date_range_params

router = APIRouter()


@router.get(
    "/protocols/",
    response_model=PaginatedResponse[ProtocolResponse],
    summary="Получение списка протоколов",
    description=(
        "Возвращает список протоколов с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает фильтрацию по лабораториям и подразделениям, сортировку."
    ),
    responses={200: {"description": "Список протоколов успешно получен"}},
)
# @IsAuthenticated
async def list_protocols(
    laboratory_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    include_deleted: bool = Query(False),
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
    is_accredited: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    search_date: Optional[str] = Query(None),
    search_sampling_act: Optional[str] = Query(None),
    search_samples: Optional[str] = Query(None),
    test_protocol_date_from: Optional[str] = Query(None),
    test_protocol_date_to: Optional[str] = Query(None),
    created_at_from: Optional[str] = Query(None),
    created_at_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает список протоколов с пагинацией или без."""
    test_protocol_date_from_parsed, test_protocol_date_to_parsed = (
        parse_date_range_params(test_protocol_date_from, test_protocol_date_to)
    )
    created_at_from_parsed, created_at_to_parsed = parse_date_range_params(
        created_at_from, created_at_to
    )

    protocols, total, total_pages = await get_protocols(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        include_deleted=include_deleted,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
        is_accredited=is_accredited,
        search=search,
        search_date=search_date,
        search_sampling_act=search_sampling_act,
        search_samples=search_samples,
        test_protocol_date_from=test_protocol_date_from_parsed,
        test_protocol_date_to=test_protocol_date_to_parsed,
        created_at_from=created_at_from_parsed,
        created_at_to=created_at_to_parsed,
    )

    items = []
    for protocol in protocols:
        protocol_dict = ProtocolResponse.model_validate(protocol).model_dump()
        if protocol.laboratory:
            protocol_dict["laboratory_name"] = protocol.laboratory.name
        if protocol.department:
            protocol_dict["department_name"] = protocol.department.name

        if protocol.samples:
            samples_data = []
            for sample_id in protocol.samples:
                sample = await get_sample_by_id(db, sample_id)
                if sample:
                    sample_dict = SampleResponse.model_validate(sample).model_dump()
                    if sample.laboratory:
                        sample_dict["laboratory_name"] = sample.laboratory.name
                    if sample.department:
                        sample_dict["department_name"] = sample.department.name
                    if sample.branch:
                        sample_dict["branch_name"] = sample.branch.name
                    if sample.sampling_location:
                        sample_dict["sampling_location_name"] = (
                            sample.sampling_location.name
                        )
                    samples_data.append(sample_dict)
            protocol_dict["samples_data"] = samples_data

        items.append(ProtocolResponse(**protocol_dict))

    return PaginatedResponse(
        items=items,
        total=total,
        page=page if page is not None else 1,
        page_size=page_size if page_size is not None else total,
        total_pages=total_pages,
    )


@router.post(
    "/protocols/",
    response_model=ProtocolResponse,
    status_code=201,
    summary="Создание нового протокола",
    description="Создает новый протокол на основе переданных данных.",
    responses={
        201: {"description": "Протокол успешно создан"},
        400: {"description": "Некорректные данные для создания протокола"},
    },
)
# @IsAuthenticated
async def create_protocol_endpoint(
    protocol_data: ProtocolCreate,
    db: AsyncSession = Depends(get_db),
):
    """Создает новый протокол на основе переданных данных."""
    protocol = await create_protocol(db, protocol_data)
    await db.commit()
    query = (
        select(Protocol)
        .where(Protocol.id == protocol.id)
        .options(
            selectinload(Protocol.laboratory),
            selectinload(Protocol.department),
        )
    )
    result = await db.execute(query)
    protocol = result.scalar_one()
    protocol_dict = ProtocolResponse.model_validate(protocol).model_dump()
    if protocol.laboratory:
        protocol_dict["laboratory_name"] = protocol.laboratory.name
    if protocol.department:
        protocol_dict["department_name"] = protocol.department.name
    return ProtocolResponse(**protocol_dict)


@router.get(
    "/protocols/{protocol_id}/",
    response_model=ProtocolResponse,
    summary="Получение протокола по ID",
    description="Возвращает информацию о протоколе по его идентификатору.",
    responses={
        200: {"description": "Протокол успешно получен"},
        404: {"description": "Протокол не найден"},
    },
)
# @IsAuthenticated
async def get_protocol(
    protocol_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Возвращает информацию о протоколе по его идентификатору."""
    protocol = await get_protocol_by_id(db, protocol_id)
    if not protocol:
        raise NotFoundError("Протокол не найден")
    protocol_dict = ProtocolResponse.model_validate(protocol).model_dump()
    if protocol.laboratory:
        protocol_dict["laboratory_name"] = protocol.laboratory.name
    if protocol.department:
        protocol_dict["department_name"] = protocol.department.name

    if protocol.samples:
        samples_data = []
        for sample_id in protocol.samples:
            sample = await get_sample_by_id(db, sample_id)
            if sample:
                sample_dict = SampleResponse.model_validate(sample).model_dump()
                if sample.laboratory:
                    sample_dict["laboratory_name"] = sample.laboratory.name
                if sample.department:
                    sample_dict["department_name"] = sample.department.name
                if sample.branch:
                    sample_dict["branch_name"] = sample.branch.name
                if sample.sampling_location:
                    sample_dict["sampling_location_name"] = (
                        sample.sampling_location.name
                    )
                samples_data.append(sample_dict)
        protocol_dict["samples_data"] = samples_data

    return ProtocolResponse(**protocol_dict)


@router.patch(
    "/protocols/{protocol_id}/",
    response_model=ProtocolResponse,
    summary="Обновление протокола",
    description="Обновляет существующий протокол. Можно обновить только указанные поля.",
    responses={
        200: {"description": "Протокол успешно обновлен"},
        404: {"description": "Протокол не найден"},
    },
)
# @IsAuthenticated
async def update_protocol_endpoint(
    protocol_id: int,
    protocol_data: ProtocolUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Обновляет существующий протокол. Можно обновить только указанные поля."""
    protocol = await update_protocol(db, protocol_id, protocol_data)
    await db.commit()
    query = (
        select(Protocol)
        .where(Protocol.id == protocol.id)
        .options(
            selectinload(Protocol.laboratory),
            selectinload(Protocol.department),
        )
    )
    result = await db.execute(query)
    protocol = result.scalar_one()
    protocol_dict = ProtocolResponse.model_validate(protocol).model_dump()
    if protocol.laboratory:
        protocol_dict["laboratory_name"] = protocol.laboratory.name
    if protocol.department:
        protocol_dict["department_name"] = protocol.department.name
    return ProtocolResponse(**protocol_dict)


@router.delete(
    "/protocols/{protocol_id}/",
    status_code=204,
    summary="Удаление протокола",
    description="Выполняет мягкое удаление протокола. Протокол помечается как удаленный.",
    responses={
        204: {"description": "Протокол успешно удален"},
        404: {"description": "Протокол не найден"},
    },
)
# @IsAuthenticated
async def delete_protocol_endpoint(
    protocol_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Выполняет мягкое удаление протокола. Протокол помечается как удаленный."""
    await delete_protocol(db, protocol_id)
    await db.commit()


@router.get(
    "/protocols/{protocol_id}/generate-excel/",
    response_class=Response,
    summary="Генерация Excel файла протокола",
    description=(
        "Генерирует Excel файл протокола на основе данных протокола и шаблона. "
        "Возвращает файл Excel для скачивания."
    ),
    responses={
        200: {
            "description": "Excel файл успешно сгенерирован",
            "content": {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {}
            },
        },
        404: {"description": "Протокол не найден"},
    },
)
# @IsAuthenticated
async def generate_protocol_excel_endpoint(
    protocol_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Генерирует Excel файл протокола на основе данных протокола и шаблона."""
    return await generate_protocol_excel(db, protocol_id)


@router.get(
    "/protocol-templates/",
    response_model=PaginatedResponse[ProtocolTemplateResponse],
    summary="Получение списка шаблонов протоколов",
    description=(
        "Возвращает список шаблонов протоколов с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает фильтрацию по лабораториям и подразделениям, сортировку."
    ),
    responses={200: {"description": "Список шаблонов протоколов успешно получен"}},
)
# @IsAuthenticated
async def list_protocol_templates(
    laboratory_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    include_deleted: bool = Query(False),
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает список шаблонов протоколов с пагинацией или без."""
    templates, total, total_pages = await get_protocol_templates(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        include_deleted=include_deleted,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    items = []
    for template in templates:
        template_dict = ProtocolTemplateResponse.model_validate(template).model_dump()
        if template.laboratory:
            template_dict["laboratory_name"] = template.laboratory.name
        if template.department:
            template_dict["department_name"] = template.department.name
        items.append(ProtocolTemplateResponse(**template_dict))

    return PaginatedResponse(
        items=items,
        total=total,
        page=page if page is not None else 1,
        page_size=page_size if page_size is not None else total,
        total_pages=total_pages,
    )


@router.get(
    "/protocol-templates/available/",
    response_model=list[ProtocolTemplateResponse],
    summary="Получение доступных шаблонов протоколов",
    description=(
        "Возвращает список доступных шаблонов протоколов для указанной лаборатории и подразделения."
    ),
    responses={200: {"description": "Список доступных шаблонов успешно получен"}},
)
# @IsAuthenticated
async def get_available_protocol_templates(
    laboratory_id: int = Query(..., description="ID лаборатории"),
    department_id: Optional[int] = Query(None, description="ID подразделения"),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает список доступных шаблонов протоколов для указанной лаборатории и подразделения."""
    templates, _, _ = await get_protocol_templates(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        include_deleted=True,
    )

    items = []
    for template in templates:
        template_dict = ProtocolTemplateResponse.model_validate(template).model_dump()
        if template.laboratory:
            template_dict["laboratory_name"] = template.laboratory.name
        if template.department:
            template_dict["department_name"] = template.department.name
        items.append(ProtocolTemplateResponse(**template_dict))

    return items


@router.post(
    "/protocol-templates/",
    response_model=ProtocolTemplateResponse,
    status_code=201,
    summary="Создание нового шаблона протокола",
    description="Создает новый шаблон протокола на основе переданных данных.",
    responses={
        201: {"description": "Шаблон протокола успешно создан"},
        400: {"description": "Некорректные данные для создания шаблона протокола"},
    },
)
# @IsAuthenticated
async def create_protocol_template_endpoint(
    template_data: ProtocolTemplateCreate,
    db: AsyncSession = Depends(get_db),
):
    """Создает новый шаблон протокола на основе переданных данных."""
    template = await create_protocol_template(db, template_data)
    await db.commit()
    query = (
        select(ProtocolTemplate)
        .where(ProtocolTemplate.id == template.id)
        .options(
            selectinload(ProtocolTemplate.laboratory),
            selectinload(ProtocolTemplate.department),
        )
    )
    result = await db.execute(query)
    template = result.scalar_one()
    template_dict = ProtocolTemplateResponse.model_validate(template).model_dump()
    if template.laboratory:
        template_dict["laboratory_name"] = template.laboratory.name
    if template.department:
        template_dict["department_name"] = template.department.name
    return ProtocolTemplateResponse(**template_dict)


@router.get(
    "/protocol-templates/{template_id}/",
    summary="Получение шаблона протокола по ID",
    description="Возвращает информацию о шаблоне протокола по его идентификатору или файл при download=true.",
    responses={
        200: {"description": "Шаблон протокола успешно получен"},
        404: {"description": "Шаблон протокола не найден"},
    },
)
# @IsAuthenticated
async def get_protocol_template(
    template_id: int,
    download: bool = Query(False, description="Скачать файл шаблона"),
    section: Optional[str] = Query(None, description="Секция для скачивания"),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает информацию о шаблоне протокола по его идентификатору или файл при download=true."""
    template = await get_protocol_template_by_id(db, template_id)
    if not template:
        raise NotFoundError("Шаблон протокола не найден")

    if download:
        from services.excel_template import get_template_file

        file_data = await get_template_file(template, section)
        # Правильное кодирование имени файла для поддержки не-ASCII символов (RFC 2231)
        encoded_filename = quote(template.file_name, safe="")
        # Используем только filename* для избежания проблем с latin-1 кодированием в Starlette
        content_disposition = f"attachment; filename*=UTF-8''{encoded_filename}"
        return Response(
            content=file_data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": content_disposition},
        )

    template_dict = ProtocolTemplateResponse.model_validate(template).model_dump()
    if template.laboratory:
        template_dict["laboratory_name"] = template.laboratory.name
    if template.department:
        template_dict["department_name"] = template.department.name
    return ProtocolTemplateResponse(**template_dict)


@router.patch(
    "/protocol-templates/{template_id}/",
    response_model=ProtocolTemplateResponse,
    summary="Обновление шаблона протокола",
    description="Обновляет существующий шаблон протокола. Можно обновить только указанные поля.",
    responses={
        200: {"description": "Шаблон протокола успешно обновлен"},
        404: {"description": "Шаблон протокола не найден"},
    },
)
# @IsAuthenticated
async def update_protocol_template_endpoint(
    template_id: int,
    template_data: ProtocolTemplateUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Обновляет существующий шаблон протокола. Можно обновить только указанные поля."""
    template = await update_protocol_template(db, template_id, template_data)
    await db.commit()
    query = (
        select(ProtocolTemplate)
        .where(ProtocolTemplate.id == template.id)
        .options(
            selectinload(ProtocolTemplate.laboratory),
            selectinload(ProtocolTemplate.department),
        )
    )
    result = await db.execute(query)
    template = result.scalar_one()
    template_dict = ProtocolTemplateResponse.model_validate(template).model_dump()
    if template.laboratory:
        template_dict["laboratory_name"] = template.laboratory.name
    if template.department:
        template_dict["department_name"] = template.department.name
    return ProtocolTemplateResponse(**template_dict)


@router.delete(
    "/protocol-templates/{template_id}/",
    status_code=204,
    summary="Удаление шаблона протокола",
    description="Выполняет мягкое удаление шаблона протокола. Шаблон помечается как удаленный.",
    responses={
        204: {"description": "Шаблон протокола успешно удален"},
        404: {"description": "Шаблон протокола не найден"},
    },
)
# @IsAuthenticated
async def delete_protocol_template_endpoint(
    template_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Выполняет мягкое удаление шаблона протокола. Шаблон помечается как удаленный."""
    await delete_protocol_template(db, template_id)
    await db.commit()


@router.post(
    "/save-excel/",
    summary="Сохранение изменений в секции Excel файла",
    description="Сохраняет изменения в указанной секции Excel файла шаблона протокола.",
    responses={
        200: {"description": "Изменения успешно сохранены"},
        400: {"description": "Ошибка при сохранении"},
    },
)
# @IsAuthenticated
async def save_excel_endpoint(
    data: str = Form(...),
    styles: str = Form(...),
    template_id: int = Form(...),
    section: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """Сохраняет изменения в секции Excel файла."""
    try:
        data_list = orjson.loads(data)
        styles_dict = orjson.loads(styles)

        result = await save_excel_section(
            db, template_id, data_list, styles_dict, section
        )
        await db.commit()
        return result
    except Exception as e:
        logger.error(f"Ошибка при сохранении Excel файла: {str(e)}", exc_info=True)
        await db.rollback()
        raise ValidationError(f"Ошибка при сохранении: {str(e)}")


@router.get(
    "/get-excel-styles/",
    summary="Получение стилей для ячеек Excel файла",
    description="Возвращает стили для ячеек в указанной секции Excel файла шаблона протокола.",
    responses={
        200: {"description": "Стили успешно получены"},
        404: {"description": "Шаблон протокола не найден"},
    },
)
# @IsAuthenticated
async def get_excel_styles_endpoint(
    template_id: int = Query(...),
    section: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает стили для ячеек в указанной секции Excel файла."""
    return await get_excel_styles(db, template_id, section)
