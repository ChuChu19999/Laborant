import type * as Xlsx from 'xlsx';

type XlsxModule = typeof Xlsx;

let xlsxModulePromise: Promise<XlsxModule> | null = null;

export function loadXlsx(): Promise<XlsxModule> {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import('xlsx');
  }

  return xlsxModulePromise;
}
