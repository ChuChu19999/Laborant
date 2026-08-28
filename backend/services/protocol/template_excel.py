from __future__ import annotations
import base64
from typing import Any
import orjson
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import DomainValidationError
from core.logger import logger
from models.protocol import ProtocolTemplate
from repositories import protocol as protocol_repo
from repositories.base import flush_entity
from schemas.protocol import ExcelCellStyle, ExcelStylesResponse, SaveExcelSectionResponse
from utils.excel_typing import require_worksheet
from utils.protocol.template_excel_edit import (
    HEADER_MARKERS_MISSING,
    apply_header_section_edits,
    extract_header_cell_styles,
)
from utils.protocol.template_markers import (
    decode_protocol_template_file,
    load_sanitized_template_workbook,
    workbook_to_xlsx_bytes,
)
from utils.versioning import next_version_string


def _parse_excel_form_json(data: str, styles: str) -> tuple[list[list[Any]], dict[str, dict[str, Any]]]:
    """Разобрать JSON из Form-полей сохранения Excel в список строк и словарь стилей."""
    try:
        data_list = orjson.loads(data)
        styles_dict = orjson.loads(styles)
    except orjson.JSONDecodeError as e:
        logger.error("Ошибка разбора JSON при сохранении Excel: {}", e)
        raise DomainValidationError(f"Некорректный JSON: {e!s}") from e
    if not isinstance(data_list, list):
        raise DomainValidationError("Поле data должно быть JSON-массивом")
    if not isinstance(styles_dict, dict):
        raise DomainValidationError("Поле styles должно быть JSON-объектом")

    normalized_rows: list[list[Any]] = []
    for row in data_list:
        if not isinstance(row, list):
            raise DomainValidationError("Каждый элемент data должен быть массивом")
        normalized_rows.append(row)

    normalized_styles: dict[str, dict[str, Any]] = {}
    for key, value in styles_dict.items():
        if not isinstance(key, str):
            raise DomainValidationError("Ключи styles должны быть строками")
        cell_style = ExcelCellStyle.model_validate(value if isinstance(value, dict) else {})
        # by_alias=False: apply_header_section_edits ждёт font_weight/font_style/…,
        # а serialize_by_alias у схемы иначе отдаёт fontWeight и стили не пишутся в xlsx.
        normalized_styles[key] = cell_style.model_dump(by_alias=False)

    return normalized_rows, normalized_styles


def _build_updated_template_file_base64(
    current_file: str,
    data: list[list[Any]],
    styles: dict[str, dict[str, Any]],
) -> str:
    """Применить правки шапки к файлу шаблона и вернуть base64 xlsx."""
    raw = decode_protocol_template_file(current_file)
    workbook = load_sanitized_template_workbook(raw)
    worksheet = require_worksheet(workbook)

    try:
        apply_header_section_edits(worksheet, data, styles)
    except ValueError as e:
        message = str(e) if str(e) else HEADER_MARKERS_MISSING
        logger.error("{}", message)
        raise DomainValidationError(message) from e

    return base64.b64encode(workbook_to_xlsx_bytes(workbook)).decode("utf-8")


def get_template_file(template: ProtocolTemplate) -> tuple[bytes, str]:
    """Вернуть байты xlsx шаблона и имя файла после очистки used range."""
    raw = decode_protocol_template_file(template.file)
    workbook = load_sanitized_template_workbook(raw)
    return workbook_to_xlsx_bytes(workbook), template.file_name


def get_excel_styles(template: ProtocolTemplate) -> ExcelStylesResponse:
    """Прочитать стили ячеек шапки шаблона; без меток шапки — DomainValidationError."""
    raw = decode_protocol_template_file(template.file)
    workbook = load_sanitized_template_workbook(raw)
    worksheet = require_worksheet(workbook)

    try:
        raw_styles = extract_header_cell_styles(worksheet)
    except ValueError as e:
        logger.error("{}", e)
        raise DomainValidationError(str(e)) from e

    styles = {key: ExcelCellStyle.model_validate(value) for key, value in raw_styles.items()}
    return ExcelStylesResponse(styles=styles)


async def save_excel_section_from_form(
    db: AsyncSession,
    template: ProtocolTemplate,
    data: str,
    styles: str,
    section: str,
) -> SaveExcelSectionResponse:
    """Разобрать Form JSON и сохранить правки секции Excel как новую версию шаблона."""
    data_list, styles_dict = _parse_excel_form_json(data, styles)
    return await save_excel_section(db, template, data_list, styles_dict, section)


async def save_excel_section(
    db: AsyncSession,
    current_template: ProtocolTemplate,
    data: list[list[Any]],
    styles: dict[str, dict[str, Any]],
    section: str,
) -> SaveExcelSectionResponse:
    """Сохранить правки секции Excel: soft_delete текущей версии и создание новой."""
    if section != "header":
        logger.error("Неизвестная секция для редактирования: {}", section)
        raise DomainValidationError(f"Неизвестная секция: {section}")

    latest_template = await protocol_repo.get_latest_protocol_template(
        db,
        current_template.name,
        current_template.laboratory_id,
        current_template.department_id,
    )
    next_version = next_version_string(latest_template.version if latest_template else None)

    current_template.soft_delete()
    await flush_entity(db)

    file_base64 = _build_updated_template_file_base64(current_template.file, data, styles)

    new_template = ProtocolTemplate(
        name=current_template.name,
        version=next_version,
        file=file_base64,
        file_name=current_template.file_name,
        laboratory_id=current_template.laboratory_id,
        department_id=current_template.department_id,
    )
    new_template = await protocol_repo.add_protocol_template(db, new_template)

    return SaveExcelSectionResponse(
        message="Файл успешно обновлен",
        version=next_version,
        template_id=new_template.id,
    )
