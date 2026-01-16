from copy import copy
import openpyxl
from core.logger import logger

DEFAULT_ROW_HEIGHT = 21  # Стандартная высота строки в пикселях

# Константы для расчета размеров текста
FONT_SIZE_PIXELS = 11  # Размер шрифта в пикселях (Times New Roman 11pt)
CHAR_WIDTH_PIXELS = 7.4  # Примерная ширина символа в пикселях
LINE_HEIGHT_PIXELS = 21  # Высота строки в пикселях
PIXELS_TO_POINTS = 0.75  # Коэффициент перевода пикселей в точки Excel


def format_decimal_ru(value) -> str:
    """
    Форматирует десятичное число для отображения в русском формате.
    Заменяет точку на запятую в десятичных числах.
    """
    if value is None:
        return ""

    try:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return ""
            try:
                value = float(value)
            except ValueError:
                return value

        if isinstance(value, (int, float)):
            return str(value).replace(".", ",")

        return str(value)
    except Exception:
        return str(value)


def copy_cell_style(source_cell, target_cell):
    """
    Безопасное копирование стилей из одной ячейки в другую
    """
    if not source_cell or not source_cell.has_style:
        return

    target_cell.font = copy(source_cell.font)
    target_cell.fill = copy(source_cell.fill)
    target_cell.border = copy(source_cell.border)
    target_cell.alignment = copy(source_cell.alignment)
    target_cell.number_format = source_cell.number_format
    target_cell.protection = copy(source_cell.protection)


def copy_row_with_styles(
    source_sheet: openpyxl.worksheet.worksheet.Worksheet,
    target_sheet: openpyxl.worksheet.worksheet.Worksheet,
    source_row: int,
    target_row: int,
) -> None:
    """
    Копирует строку с сохранением стилей из исходного листа в целевой.
    """
    try:
        logger.info(f"Начинаем копирование строки {source_row} в строку {target_row}")

        # Получаем максимальное количество столбцов
        max_col = source_sheet.max_column
        logger.info(f"Максимальное количество столбцов: {max_col}")

        # Копируем каждую ячейку в строке
        for col in range(1, max_col + 1):
            try:
                source_cell = source_sheet.cell(row=source_row, column=col)
                target_cell = target_sheet.cell(row=target_row, column=col)

                target_cell.value = source_cell.value
                copy_cell_style(source_cell, target_cell)

            except Exception as cell_error:
                logger.error(
                    f"Ошибка при копировании ячейки [{source_row}, {col}]: {str(cell_error)}"
                )
                continue

        logger.info(f"Успешно скопирована строка {source_row} -> {target_row}")

    except Exception as e:
        logger.error(f"Ошибка при копировании строки {source_row}: {str(e)}")
        raise


def copy_row_formatting(
    source_sheet, target_sheet, source_row, target_row, merged_cells_map=None
):
    """
    Копирует все форматирование строки: стили, размеры и объединенные ячейки
    """
    if source_row in source_sheet.row_dimensions:
        target_sheet.row_dimensions[target_row] = copy(
            source_sheet.row_dimensions[source_row]
        )

    copy_row_with_styles(source_sheet, target_sheet, source_row, target_row)

    if merged_cells_map is not None:
        for merged_range in source_sheet.merged_cells.ranges:
            if merged_range.min_row == source_row:
                new_range = openpyxl.worksheet.cell_range.CellRange(
                    min_col=merged_range.min_col,
                    min_row=target_row,
                    max_col=merged_range.max_col,
                    max_row=target_row + (merged_range.max_row - merged_range.min_row),
                )
                merged_cells_map.add(new_range)


def copy_column_dimensions(source_sheet, target_sheet):
    """
    Копирует размеры столбцов из исходного листа в целевой.
    """
    try:
        for key, value in source_sheet.column_dimensions.items():
            target_sheet.column_dimensions[key].width = value.width
            target_sheet.column_dimensions[key].hidden = value.hidden
    except Exception as e:
        logger.error(f"Ошибка при копировании размеров столбцов: {str(e)}")


def get_cell_width(sheet, row, col):
    """
    Получает ширину ячейки в пикселях, учитывая объединенные ячейки.
    """
    try:
        # Проверяем, является ли ячейка частью объединенной ячейки
        for merged_range in sheet.merged_cells.ranges:
            if (
                merged_range.min_row <= row <= merged_range.max_row
                and merged_range.min_col <= col <= merged_range.max_col
            ):
                # Вычисляем общую ширину объединенной ячейки
                total_width = 0
                for col_idx in range(merged_range.min_col, merged_range.max_col + 1):
                    if col_idx in sheet.column_dimensions:
                        col_width = sheet.column_dimensions[col_idx].width
                        if col_width:
                            # Переводим ширину столбца из единиц Excel в пиксели
                            # Примерно 7 пикселей на единицу ширины Excel
                            total_width += col_width * 7
                        else:
                            total_width += 64  # Стандартная ширина столбца
                    else:
                        total_width += 64
                return total_width

        # Если ячейка не объединена, возвращаем ширину столбца
        if col in sheet.column_dimensions:
            col_width = sheet.column_dimensions[col].width
            if col_width:
                return col_width * 7  # Переводим в пиксели
            else:
                return 64  # Стандартная ширина столбца
        else:
            return 64

    except Exception as e:
        logger.error(f"Ошибка при получении ширины ячейки [{row}, {col}]: {str(e)}")
        return 64  # Возвращаем стандартную ширину в случае ошибки


def calculate_text_height(text, cell_width_pixels, font_size_pixels=FONT_SIZE_PIXELS):
    """
    Рассчитывает высоту текста в пикселях с учетом переноса строк.
    """
    if not text or not isinstance(text, str):
        return LINE_HEIGHT_PIXELS

    try:
        # Примерная ширина символа в пикселях (учитываем, что русские буквы могут быть шире)
        char_width = CHAR_WIDTH_PIXELS

        # Количество символов, которые помещаются в одну строку
        chars_per_line = max(1, int(cell_width_pixels / char_width))

        # Если текст помещается в одну строку, возвращаем стандартную высоту
        if len(text) <= chars_per_line:
            return LINE_HEIGHT_PIXELS

        # Разбиваем текст на строки
        lines = []
        current_line = ""

        for char in text:
            if len(current_line) >= chars_per_line:
                lines.append(current_line)
                current_line = char
            else:
                current_line += char

        if current_line:
            lines.append(current_line)

        # Высота текста = количество строк * высота строки
        text_height = len(lines) * LINE_HEIGHT_PIXELS

        # Добавляем небольшой отступ только для многострочного текста
        if len(lines) > 1:
            text_height += 4

        return text_height

    except Exception as e:
        logger.error(f"Ошибка при расчете высоты текста: {str(e)}")
        return LINE_HEIGHT_PIXELS


def adjust_cell_height_if_needed(sheet, row, col, text, min_height_pixels=35):
    """
    Увеличивает высоту ячейки, если текст не помещается.
    Возвращает True, если высота была изменена.
    """
    try:
        if not text or not isinstance(text, str):
            return False

        # Получаем текущую высоту строки
        current_height = DEFAULT_ROW_HEIGHT
        if row in sheet.row_dimensions:
            current_height = sheet.row_dimensions[row].height or DEFAULT_ROW_HEIGHT

        # Переводим высоту из точек в пиксели
        current_height_pixels = current_height / PIXELS_TO_POINTS

        # Получаем ширину ячейки
        cell_width_pixels = get_cell_width(sheet, row, col)

        # Рассчитываем необходимую высоту для текста
        required_height_pixels = calculate_text_height(text, cell_width_pixels)

        # Проверяем, нужно ли увеличить высоту
        if required_height_pixels > current_height_pixels:
            # Устанавливаем фиксированную высоту 35 пикселей
            new_height_pixels = 35
            new_height_points = new_height_pixels * PIXELS_TO_POINTS

            # Устанавливаем высоту строки
            if row not in sheet.row_dimensions:
                sheet.row_dimensions[row] = openpyxl.worksheet.dimensions.RowDimension(
                    sheet, row
                )
            sheet.row_dimensions[row].height = new_height_points

            logger.info(
                f"Увеличена высота ячейки [{row}, {col}] с {current_height_pixels:.1f} до {new_height_pixels:.1f} пикселей"
            )
            return True

        return False

    except Exception as e:
        logger.error(f"Ошибка при настройке высоты ячейки [{row}, {col}]: {str(e)}")
        return False


def adjust_row_height_for_text(sheet, row, text_columns):
    """
    Настраивает высоту строки для текста в указанных столбцах.
    """
    try:
        max_required_height = 35  # Минимальная высота в пикселях

        for col, text in text_columns:
            if text and isinstance(text, str):
                cell_width_pixels = get_cell_width(sheet, row, col)
                required_height = calculate_text_height(text, cell_width_pixels)
                max_required_height = max(max_required_height, required_height)

        # Получаем текущую высоту строки
        current_height = DEFAULT_ROW_HEIGHT
        if row in sheet.row_dimensions:
            current_height = sheet.row_dimensions[row].height or DEFAULT_ROW_HEIGHT

        # Переводим высоту из точек в пиксели
        current_height_pixels = current_height / PIXELS_TO_POINTS

        # Если требуется увеличить высоту
        if max_required_height > current_height_pixels:
            # Устанавливаем фиксированную высоту 35 пикселей
            new_height_points = 35 * PIXELS_TO_POINTS

            # Устанавливаем высоту строки
            if row not in sheet.row_dimensions:
                sheet.row_dimensions[row] = openpyxl.worksheet.dimensions.RowDimension(
                    sheet, row
                )
            sheet.row_dimensions[row].height = new_height_points

            logger.info(
                f"Увеличена высота строки {row} с {current_height_pixels:.1f} до 35.0 пикселей"
            )
            return True

        return False

    except Exception as e:
        logger.error(f"Ошибка при настройке высоты строки {row}: {str(e)}")
        return False


def map_test_object_to_suffix(text: str) -> str:
    """
    Возвращает суффикс в зависимости от объекта испытаний.
    """
    if not text:
        return ""
    value = text.strip().lower()
    if "дегазированный конденсат" in value:
        return "дк"
    if "нефть" in value or "нефть калибровочная" in value:
        return "н"
    if "нефтеконденсатная смесь" in value:
        return "нкс"
    if "дизельное топливо" in value:
        return "дт"
    if "отработанные нефтепродукты" in value:
        return "он"
    if "масло турбинное" in value:
        return "м"
    if "масло авиационное" in value:
        return "м"
    if "смесь жидких углеводородов" in value:
        return "с"
    if "ингибитор коррозии" in value:
        return "ик"
    return ""


def check_method_name(method_name, test_objects):
    """
    Проверяет, соответствует ли метод объекту испытаний
    """
    method_lower = method_name.lower()
    test_objects_lower = [obj.lower() for obj in test_objects]

    # Если в методе есть "нефть", но в объектах испытаний нет нефти
    if "нефть" in method_lower and not any(
        "нефть" in obj for obj in test_objects_lower
    ):
        logger.info(
            f"Метод '{method_name}' содержит слово 'нефть', но в объектах испытаний нет нефти"
        )
        return False

    # Если в методе есть "конденсат", проверяем наличие конденсата в объектах испытаний
    if "конденсат" in method_lower:
        has_condensate = any("конденсат" in obj for obj in test_objects_lower)
        if has_condensate:
            logger.info(
                f"Метод '{method_name}' подходит для объектов испытаний (найден конденсат)"
            )
            return True
        else:
            logger.info(
                f"Метод '{method_name}' содержит слово 'конденсат', но в объектах испытаний нет конденсата"
            )
            return False
    return True


def find_text_in_workbook(workbook, search_text):
    """
    Ищет указанный текст во всех листах книги Excel.
    Возвращает список всех найденных вхождений в формате [(лист, строка, столбец), ...].
    """
    try:
        results = []
        for sheet_name in workbook.sheetnames:
            sheet = workbook[sheet_name]
            for row_idx, row in enumerate(sheet.iter_rows(values_only=True), 1):
                for col_idx, cell_value in enumerate(row, 1):
                    if (
                        cell_value
                        and isinstance(cell_value, str)
                        and search_text.lower() in cell_value.lower()
                    ):
                        results.append((sheet_name, row_idx, col_idx))
        return results
    except Exception as e:
        logger.error(f"Ошибка при поиске текста '{search_text}': {str(e)}")
        return []
