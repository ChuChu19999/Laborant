import React, { useEffect, useRef, useState } from 'react';
import { BoldOutlined, DownloadOutlined, ItalicOutlined } from '@ant-design/icons';
import { Button, Spin, message } from 'antd';
import { read, utils } from 'xlsx';
import { protocolsApi, type CellStyle } from '../../../shared/api/protocols';
import { Select } from '../../../shared/ui/FormItems';
import Tooltip from '../../../shared/ui/Tooltip/Tooltip';
import './ExcelEditor.css';

const { Option } = Select;

interface ExcelEditorProps {
  templateId: number;
  section: string;
  onDataChange: (
    data: Array<Array<string | null>>,
    templateId: number | null,
    styles: Record<string, CellStyle> | null
  ) => void;
}

const ExcelEditor: React.FC<ExcelEditorProps> = ({ templateId, section, onDataChange }) => {
  const [data, setData] = useState<Array<Array<string | null>>>([['']]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [selectedRange, setSelectedRange] = useState<{
    from: { row: number; col: number };
    to: { row: number; col: number };
  } | null>(null);
  const [cellStyles, setCellStyles] = useState<Record<string, CellStyle>>({});
  const [lastSavedTemplateId, setLastSavedTemplateId] = useState<number | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (templateId && templateId !== lastSavedTemplateId) {
      loadExcelData();
    }
    setLastSavedTemplateId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const loadExcelData = async () => {
    if (!templateId) {
      return;
    }

    if (loading) {
      return;
    }

    try {
      setError(null);
      setLoading(true);

      // Получаем стили из активного шаблона
      const stylesResponse = await protocolsApi.getExcelStyles(templateId, section);

      if (stylesResponse.error) {
        throw new Error(stylesResponse.error);
      }

      setCellStyles(stylesResponse.styles || {});
      const styles = stylesResponse.styles || {};

      // Получаем файл для чтения
      const fileResponse = await protocolsApi.getProtocolTemplateFile(templateId, section);

      if (!fileResponse || fileResponse.byteLength === 0) {
        throw new Error('Получен пустой файл с сервера');
      }

      // Читаем файл Excel
      const workbook = read(fileResponse, {
        type: 'array',
        cellFormula: false,
        cellText: true,
      });

      if (!workbook || !workbook.SheetNames || !workbook.SheetNames.length) {
        throw new Error('Не удалось прочитать файл Excel');
      }

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) {
        throw new Error('Не удалось найти лист в файле Excel');
      }

      // Только колонка A: полный sheet_to_json по used range (у НСПК ~1000×140)
      // подвешивает вкладку. Шапка редактируется только в A.
      const sheetRef = firstSheet['!ref'];
      if (!sheetRef) {
        throw new Error('В файле не найден диапазон ячеек');
      }
      const range = utils.decode_range(sheetRef);

      let startHeaderIndex = -1;
      let endHeaderIndex = -1;
      for (let row = range.s.r; row <= range.e.r; row += 1) {
        const cell = firstSheet[utils.encode_cell({ r: row, c: 0 })];
        const value = cell != null && cell.v != null ? String(cell.v).trim() : '';
        if (value === '{{start_header}}') {
          startHeaderIndex = row;
        }
        if (value === '{{end_header}}') {
          endHeaderIndex = row;
          break;
        }
      }

      if (startHeaderIndex === -1 || endHeaderIndex === -1 || startHeaderIndex >= endHeaderIndex) {
        throw new Error(
          'В файле не найдены метки {{start_header}} и {{end_header}}. Добавьте метки в шаблон для редактирования шапки.'
        );
      }

      const headerData: Array<Array<string | null>> = [];
      for (let row = startHeaderIndex + 1; row < endHeaderIndex; row += 1) {
        const cell = firstSheet[utils.encode_cell({ r: row, c: 0 })];
        const value = cell != null && cell.v != null && String(cell.v) !== '' ? String(cell.v) : '';
        headerData.push([value]);
      }

      setData(headerData);

      // Передаем данные и стили родительскому компоненту
      if (onDataChange) {
        onDataChange(headerData, null, styles);
      }
    } catch (error) {
      console.error('Ошибка при загрузке данных:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить данные. Пожалуйста, проверьте, что файл существует и доступен.';
      message.error(errorMessage);
      setError(errorMessage);
      setData([['']]);
    } finally {
      setLoading(false);
    }
  };

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

    // Передаем обновленные стили в родительский компонент
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
          fontWeight: currentStyle.fontWeight === 'bold' ? 'normal' : 'bold',
        };
        break;
      case 'italic':
        newStyle = {
          fontStyle: currentStyle.fontStyle === 'italic' ? 'normal' : 'italic',
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
      const fileResponse = await protocolsApi.getProtocolTemplateFile(templateId, section);

      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(new Blob([fileResponse]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `template_${templateId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success('Файл успешно скачан');
    } catch (error) {
      console.error('Ошибка при скачивании файла:', error);
      message.error('Ошибка при скачивании файла');
    }
  };

  const isStyleActive = (styleType: string): boolean | number => {
    const currentStyles = getCurrentCellStyles();

    switch (styleType) {
      case 'bold':
        return currentStyles.fontWeight === 'bold';
      case 'italic':
        return currentStyles.fontStyle === 'italic';
      case 'fontSize':
        return currentStyles.fontSize ? parseInt(currentStyles.fontSize) : 14;
      default:
        return false;
    }
  };

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

  const getCellStyle = (row: number): React.CSSProperties => {
    const cellKey = `${row}-0`;
    const style = cellStyles[cellKey] || {};
    return {
      fontWeight: style.fontWeight || 'normal',
      fontStyle: style.fontStyle || 'normal',
      fontSize: style.fontSize || '14px',
      textAlign: (style.textAlign || 'center') as 'left' | 'center' | 'right',
    };
  };

  if (!templateId) {
    return null;
  }

  if (loading) {
    return (
      <div className="loading-overlay">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="excel-editor">
      <div className="toolbar">
        <Tooltip title="Жирный" placement="top">
          <Button
            icon={<BoldOutlined />}
            onClick={() => applyFormatting({ type: 'bold' })}
            disabled={!selectedCell && !selectedRange}
            className={isStyleActive('bold') ? 'active' : ''}
          />
        </Tooltip>
        <Tooltip title="Курсив" placement="top">
          <Button
            icon={<ItalicOutlined />}
            onClick={() => applyFormatting({ type: 'italic' })}
            disabled={!selectedCell && !selectedRange}
            className={isStyleActive('italic') ? 'active' : ''}
          />
        </Tooltip>
        <Tooltip title="Размер шрифта" placement="top">
          <Select
            className="font-size-select"
            onChange={size => applyFormatting({ type: 'fontSize', size: size as number })}
            value={isStyleActive('fontSize') as number}
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
        <div className="toolbar-separator" />
        <Tooltip title="Скачать текущий файл" placement="top">
          <Button icon={<DownloadOutlined />} onClick={downloadCurrentFile} />
        </Tooltip>
      </div>
      <div className="table-container">
        <table ref={tableRef} className="excel-table">
          <thead>
            <tr>
              <th className="row-header">№</th>
              <th>A</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="row-header">{rowIndex + 1}</td>
                <td
                  style={getCellStyle(rowIndex)}
                  onClick={() => {
                    setSelectedCell({ row: rowIndex, col: 0 });
                    setSelectedRange(null);
                  }}
                  onMouseDown={e => {
                    if (e.shiftKey && selectedCell) {
                      setSelectedRange({
                        from: selectedCell,
                        to: { row: rowIndex, col: 0 },
                      });
                      setSelectedCell(null);
                    }
                  }}
                  className={
                    selectedCell?.row === rowIndex ||
                    (selectedRange &&
                      rowIndex >= Math.min(selectedRange.from.row, selectedRange.to.row) &&
                      rowIndex <= Math.max(selectedRange.from.row, selectedRange.to.row))
                      ? 'selected'
                      : ''
                  }
                >
                  <textarea
                    value={row[0] || ''}
                    onChange={e => handleCellChange(rowIndex, e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '40px',
                      border: 'none',
                      outline: 'none',
                      resize: 'none',
                      background: 'transparent',
                      ...getCellStyle(rowIndex),
                    }}
                    rows={1}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default ExcelEditor;
