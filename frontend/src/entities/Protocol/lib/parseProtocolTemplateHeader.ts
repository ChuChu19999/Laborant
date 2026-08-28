import { loadXlsx } from '@/shared/lib/xlsx';

export interface ParsedProtocolTemplateHeader {
  headerData: (string | null)[][];
}

export const parseProtocolTemplateHeader = async (
  fileBuffer: ArrayBuffer
): Promise<ParsedProtocolTemplateHeader> => {
  if (!fileBuffer || fileBuffer.byteLength === 0) {
    throw new Error('Получен пустой файл с сервера');
  }

  const { read, utils } = await loadXlsx();
  const workbook = read(fileBuffer, {
    type: 'array',
    cellFormula: false,
    cellText: true,
  });

  if (!workbook?.SheetNames?.length) {
    throw new Error('Не удалось прочитать файл Excel');
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Не удалось найти лист в файле Excel');
  }

  const firstSheet = workbook.Sheets[firstSheetName];
  if (!firstSheet) {
    throw new Error('Не удалось найти лист в файле Excel');
  }

  const sheetRef = firstSheet['!ref'];
  if (!sheetRef) {
    throw new Error('В файле не найден диапазон ячеек');
  }

  const range = utils.decode_range(sheetRef);

  let startHeaderIndex = -1;
  let endHeaderIndex = -1;
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    const cell = firstSheet[utils.encode_cell({ r: row, c: 0 })] as { v?: unknown } | undefined;
    const rawValue: unknown = cell?.v ?? null;
    const value =
      typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean'
        ? String(rawValue).trim()
        : '';
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

  const headerData: (string | null)[][] = [];
  for (let row = startHeaderIndex + 1; row < endHeaderIndex; row += 1) {
    const cell = firstSheet[utils.encode_cell({ r: row, c: 0 })] as { v?: unknown } | undefined;
    const rawValue: unknown = cell?.v ?? null;
    const value =
      typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean'
        ? String(rawValue)
        : '';
    headerData.push([value]);
  }

  return { headerData };
};
