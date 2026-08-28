from __future__ import annotations
import base64
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import DomainValidationError, NotFoundError
from models.protocol import ProtocolTemplate
from repositories import protocol as protocol_repo
from repositories.base import flush_entity
from schemas.protocol import ProtocolTemplateCreate, ProtocolTemplateUpdate
from services.department import require_department_by_id
from services.laboratory import require_laboratory_by_id
from utils.protocol.template_markers import (
    decode_protocol_template_file,
    load_sanitized_template_workbook,
    workbook_to_xlsx_bytes,
)
from utils.versioning import next_version_string


def _sanitize_template_file_base64(file_payload: str) -> str:
    """Прогнать файл шаблона через decode/sanitize и вернуть base64."""
    raw = decode_protocol_template_file(file_payload)
    sanitized_bytes = workbook_to_xlsx_bytes(load_sanitized_template_workbook(raw))
    return base64.b64encode(sanitized_bytes).decode("utf-8")


async def get_protocol_template_by_id(
    db: AsyncSession, template_id: int, include_deleted: bool = False
) -> ProtocolTemplate | None:
    """Получить шаблон протокола по ID."""
    return await protocol_repo.get_protocol_template_by_id(db, template_id, include_deleted)


async def require_protocol_template_by_id(
    db: AsyncSession, template_id: int, include_deleted: bool = False
) -> ProtocolTemplate:
    """Вернуть шаблон протокола по ID, иначе вызвать NotFoundError."""
    template = await get_protocol_template_by_id(db, template_id, include_deleted)
    if not template:
        raise NotFoundError("Шаблон протокола не найден")
    return template


async def get_protocol_templates(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    include_deleted: bool = False,
    page: int | None = None,
    page_size: int | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[ProtocolTemplate], int]:
    """Получить список шаблонов протоколов."""
    return await protocol_repo.get_protocol_templates(
        db,
        laboratory_id,
        department_id,
        include_deleted,
        page,
        page_size,
        sort_by,
        sort_order,
    )


async def create_protocol_template(db: AsyncSession, template_data: ProtocolTemplateCreate) -> ProtocolTemplate:
    """Создать шаблон протокола."""
    await require_laboratory_by_id(db, template_data.laboratory_id, include_deleted=True)

    if template_data.department_id is not None:
        department = await require_department_by_id(db, template_data.department_id, include_deleted=True)
        if department.laboratory_id != template_data.laboratory_id:
            raise DomainValidationError("Подразделение должно принадлежать выбранной лаборатории")

    latest_template = await protocol_repo.get_latest_protocol_template(
        db,
        template_data.name,
        template_data.laboratory_id,
        template_data.department_id,
    )
    next_version = next_version_string(latest_template.version if latest_template else None)

    sanitized_file = _sanitize_template_file_base64(template_data.file)

    template = ProtocolTemplate(
        name=template_data.name,
        version=next_version,
        file=sanitized_file,
        file_name=template_data.file_name,
        laboratory_id=template_data.laboratory_id,
        department_id=template_data.department_id,
    )
    template = await protocol_repo.add_protocol_template(db, template)
    return await require_protocol_template_by_id(db, template.id)


async def update_protocol_template(
    db: AsyncSession, template: ProtocolTemplate, template_data: ProtocolTemplateUpdate
) -> ProtocolTemplate:
    """Обновить шаблон протокола."""
    update_data = template_data.model_dump(exclude_unset=True)
    if "file" in update_data and update_data["file"] is not None:
        update_data["file"] = _sanitize_template_file_base64(update_data["file"])

    for key, value in update_data.items():
        setattr(template, key, value)

    await flush_entity(db)
    return await require_protocol_template_by_id(db, template.id)
