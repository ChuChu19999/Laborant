import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { notify } from '@/shared/lib/notify';
import { AntdWavelessProvider } from '@/shared/ui/AntdWavelessProvider';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/FormItems';
import { BoldOutlined, DownloadOutlined, ItalicOutlined } from '@/shared/ui/icons';
import { Spin } from '@/shared/ui/Spin';
import { Tooltip } from '@/shared/ui/Tooltip';
import { isBoldStyle, isItalicStyle } from '../../lib/cellStyleFormat';
import {
  downloadProtocolTemplateFile,
  useProtocolTemplateExcelSection,
} from '../../model/useProtocolTemplateExcel';
import type { CellStyle } from '../../api';
import './ExcelEditor.css';

const { Option } = Select;

interface ExcelEditorProps {
  templateId: number;
  section: string;
  onDataChange: (
    data: (string | null)[][],
    templateId: number | null,
    styles: Record<string, CellStyle> | null
  ) => void;
}

interface ExcelCellProps {
  value: string;
  cellStyle: CellStyle;
  isSelected: boolean;
  onSelect: () => void;
  onRangeSelect: (e: React.MouseEvent) => void;
  onChange: (value: string) => void;
}

/** Ячейка таблицы: классы выравнивания/начертания и размер шрифта через CSS-переменную. */
const ExcelCell = ({
  value,
  cellStyle,
  isSelected,
  onSelect,
  onRangeSelect,
  onChange,
}: ExcelCellProps) => {
  const tdRef = useRef<HTMLTableCellElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fontSize = cellStyle.fontSize || '14px';
  const align = cellStyle.textAlign || 'center';
  const fontFamily = cellStyle.fontFamily;
  const formatClassName = [
    isBoldStyle(cellStyle) ? 'excel-cell-bold' : '',
    isItalicStyle(cellStyle) ? 'excel-cell-italic' : '',
    `excel-cell-align-${align}`,
  ]
    .filter(Boolean)
    .join(' ');

  useLayoutEffect(() => {
    tdRef.current?.style.setProperty('--excel-cell-font-size', fontSize);
    textareaRef.current?.style.setProperty('--excel-cell-font-size', fontSize);
    if (fontFamily) {
      tdRef.current?.style.setProperty('--excel-cell-font-family', fontFamily);
      textareaRef.current?.style.setProperty('--excel-cell-font-family', fontFamily);
    } else {
      tdRef.current?.style.removeProperty('--excel-cell-font-family');
      textareaRef.current?.style.removeProperty('--excel-cell-font-family');
    }
  }, [fontSize, fontFamily]);

  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLTableCellElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <td
      ref={tdRef}
      className={`${formatClassName}${isSelected ? ' selected' : ''}`}
      role="gridcell"
      tabIndex={0}
      onClick={onSelect}
      onMouseDown={onRangeSelect}
      onKeyDown={handleCellKeyDown}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`excel-editor-cell-textarea ${formatClassName}`}
        rows={1}
      />
    </td>
  );
};

const ExcelEditor = ({ templateId, section, onDataChange }: ExcelEditorProps) => {
  const [data, setData] = useState<(string | null)[][]>([['']]);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [selectedRange, setSelectedRange] = useState<{
    from: { row: number; col: number };
    to: { row: number; col: number };
  } | null>(null);
  const [cellStyles, setCellStyles] = useState<Record<string, CellStyle>>({});
  const tableRef = useRef<HTMLTableElement>(null);

  const {
    data: excelData,
    isLoading,
    isError,
    error: queryError,
  } = useProtocolTemplateExcelSection(templateId, section);

  const onDataChangeRef = useRef(onDataChange);
  onDataChangeRef.current = onDataChange;

  useEffect(() => {
    if (!excelData) {
      return;
    }

    setData(excelData.headerData);
    setCellStyles(excelData.styles);
    onDataChangeRef.current(excelData.headerData, null, excelData.styles);
  }, [excelData]);

  useEffect(() => {
    if (isError) {
      const errorMessage =
        queryError instanceof Error
          ? queryError.message
          : 'Не удалось загрузить данные. Пожалуйста, проверьте, что файл существует и доступен.';
      notify.error(errorMessage);
      setData([['']]);
    }
  }, [isError, queryError]);

  const errorMessage = isError
    ? queryError instanceof Error
      ? queryError.message
      : 'Не удалось загрузить данные. Пожалуйста, проверьте, что файл существует и доступен.'
    : null;

  const getCurrentCellStyles = () => {
    if (!selectedCell && !selectedRange) return {};

    if (selectedCell) {
      const cellKey = `${selectedCell.row}-0`;
      return cellStyles[cellKey] || {};
    }

    if (selectedRange) {
      const { from } = selectedRange;
      const firstCellKey = `${from.row}-0`;
      return cellStyles[firstCellKey] || {};
    }

    return {};
  };

  const applyStylesToRange = (newStyle: CellStyle) => {
    const updatedStyles = { ...cellStyles };

    if (selectedRange) {
      const { from, to } = selectedRange;
      const startRow = Math.min(from.row, to.row);
      const endRow = Math.max(from.row, to.row);

      for (let row = startRow; row <= endRow; row++) {
        const cellKey = `${row}-0`;
        updatedStyles[cellKey] = {
          ...(updatedStyles[cellKey] || {}),
          ...newStyle,
        };
      }
    } else if (selectedCell) {
      const cellKey = `${selectedCell.row}-0`;
      updatedStyles[cellKey] = {
        ...(updatedStyles[cellKey] || {}),
        ...newStyle,
      };
    }

    setCellStyles(updatedStyles);

    if (onDataChange) {
      onDataChange(data, null, updatedStyles);
    }
  };

  const applyFormatting = (format: { type: string; size?: number }) => {
    const currentStyle = getCurrentCellStyles();
    let newStyle: CellStyle = {};

    switch (format.type) {
      case 'bold':
        newStyle = {
          fontWeight: isBoldStyle(currentStyle) ? 'normal' : 'bold',
        };
        break;
      case 'italic':
        newStyle = {
          fontStyle: isItalicStyle(currentStyle) ? 'normal' : 'italic',
        };
        break;
      case 'fontSize':
        newStyle = {
          fontSize: `${format.size}px`,
        };
        break;
    }

    applyStylesToRange(newStyle);
  };

  const downloadCurrentFile = async () => {
    try {
      const fileResponse = await downloadProtocolTemplateFile(templateId, section);

      const url = window.URL.createObjectURL(new Blob([fileResponse]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `template_${templateId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      notify.success('Файл успешно скачан');
    } catch {
      notify.error('Ошибка при скачивании файла');
    }
  };

  const isStyleActive = (styleType: string): boolean | number | string => {
    const currentStyles = getCurrentCellStyles();

    switch (styleType) {
      case 'bold':
        return isBoldStyle(currentStyles);
      case 'italic':
        return isItalicStyle(currentStyles);
      case 'fontSize':
        return currentStyles.fontSize ? parseInt(currentStyles.fontSize, 10) : 14;
      case 'fontFamily':
        return currentStyles.fontFamily || '';
      default:
        return false;
    }
  };

  const currentFontFamilyLabel = (() => {
    const family = isStyleActive('fontFamily');
    if (typeof family !== 'string' || !family) {
      return 'Шрифт: по умолчанию';
    }
    return `Шрифт: ${family}`;
  })();

  const handleCellChange = (row: number, value: string) => {
    const updatedData = [...data];
    while (updatedData.length <= row) {
      updatedData.push(['']);
    }
    if (!Array.isArray(updatedData[row])) {
      updatedData[row] = [''];
    }
    updatedData[row][0] = value;
    setData(updatedData);
    if (onDataChange) {
      onDataChange(updatedData, null, cellStyles);
    }
  };

  if (!templateId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="loading-overlay">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="excel-editor">
      <AntdWavelessProvider>
        <div className="toolbar">
          <Tooltip title="Жирный" placement="top">
            <Button
              icon={<BoldOutlined className="toolbar-btn-icon" />}
              onClick={() => applyFormatting({ type: 'bold' })}
              disabled={!selectedCell && !selectedRange}
              className={`toolbar-btn${isStyleActive('bold') ? ' active' : ''}`}
            />
          </Tooltip>
          <Tooltip title="Курсив" placement="top">
            <Button
              icon={<ItalicOutlined className="toolbar-btn-icon" />}
              onClick={() => applyFormatting({ type: 'italic' })}
              disabled={!selectedCell && !selectedRange}
              className={`toolbar-btn${isStyleActive('italic') ? ' active' : ''}`}
            />
          </Tooltip>
          <Tooltip title="Размер шрифта" placement="top">
            <Select
              className="font-size-select"
              onChange={size => applyFormatting({ type: 'fontSize', size: size as number })}
              value={isStyleActive('fontSize')}
              disabled={!selectedCell && !selectedRange}
              style={{ width: 100 }}
            >
              {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72, 96].map(size => (
                <Option key={size} value={size}>
                  {size}px
                </Option>
              ))}
            </Select>
          </Tooltip>
          <span className="toolbar-font-label" title={currentFontFamilyLabel}>
            {currentFontFamilyLabel}
          </span>
          <div className="toolbar-separator" />
          <Tooltip title="Скачать текущий файл" placement="top">
            <Button
              icon={<DownloadOutlined className="toolbar-btn-icon" />}
              onClick={downloadCurrentFile}
              className="toolbar-btn"
            />
          </Tooltip>
        </div>
      </AntdWavelessProvider>
      <div className="excel-editor-table-container">
        <table ref={tableRef} className="excel-table">
          <thead>
            <tr>
              <th className="row-header">№</th>
              <th>A</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => {
              const isSelected = Boolean(
                selectedCell?.row === rowIndex ||
                (selectedRange &&
                  rowIndex >= Math.min(selectedRange.from.row, selectedRange.to.row) &&
                  rowIndex <= Math.max(selectedRange.from.row, selectedRange.to.row))
              );
              return (
                <tr key={rowIndex}>
                  <td className="row-header">{rowIndex + 1}</td>
                  <ExcelCell
                    value={row[0] || ''}
                    cellStyle={cellStyles[`${rowIndex}-0`] || {}}
                    isSelected={isSelected}
                    onSelect={() => {
                      setSelectedCell({ row: rowIndex, col: 0 });
                      setSelectedRange(null);
                    }}
                    onRangeSelect={e => {
                      if (e.shiftKey && selectedCell) {
                        setSelectedRange({
                          from: selectedCell,
                          to: { row: rowIndex, col: 0 },
                        });
                        setSelectedCell(null);
                      }
                    }}
                    onChange={value => handleCellChange(rowIndex, value)}
                  />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {errorMessage && <div className="error-message">{errorMessage}</div>}
    </div>
  );
};

export default ExcelEditor;
