from __future__ import annotations
from openpyxl.cell.cell import Cell
from openpyxl.styles import Font
from openpyxl.worksheet.worksheet import Worksheet
from utils.excel_typing import as_writable_cell

_DEFAULT_FONT_NAME = "Times New Roman"
_DEFAULT_FONT_SIZE = 12


def apply_report_font(
    cell: Cell,
    *,
    name: str = _DEFAULT_FONT_NAME,
    size: int | None = None,
) -> None:
    """Применяет шрифт к ячейке отчёта, сохраняя начертание из шаблона."""
    font_size = _DEFAULT_FONT_SIZE if size is None else size
    old = cell.font
    if old:
        cell.font = Font(
            name=name,
            size=font_size,
            bold=old.bold,
            italic=old.italic,
            underline=old.underline,
            strike=old.strike,
            color="FF000000",
        )
        return
    cell.font = Font(name=name, size=font_size, color="FF000000")


def merged_cell_anchor(ws: Worksheet, row: int, col: int) -> tuple[int, int]:
    """Возвращает верхнюю левую ячейку объединённого диапазона."""
    for merged in ws.merged_cells.ranges:
        if merged.min_row <= row <= merged.max_row and merged.min_col <= col <= merged.max_col:
            return merged.min_row, merged.min_col
    return row, col


def writable_cell(ws: Worksheet, row: int, col: int) -> Cell:
    """Ячейка, в которую можно записать значение (верхняя левая при объединении)."""
    anchor_row, anchor_col = merged_cell_anchor(ws, row, col)
    cell = as_writable_cell(ws.cell(row=anchor_row, column=anchor_col))
    if cell is None:
        raise TypeError(f"Ячейка [{row}, {col}] недоступна для записи")
    return cell
