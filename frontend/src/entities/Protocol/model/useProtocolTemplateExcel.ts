import { useAutoRefetchQuery } from '@/shared/model';
import { type CellStyle, protocolKeys, protocolsApi } from '../api';
import { normalizeCellStyles } from '../lib/normalizeCellStyles';
import { parseProtocolTemplateHeader } from '../lib/parseProtocolTemplateHeader';

export interface ProtocolTemplateExcelSectionData {
  headerData: (string | null)[][];
  styles: Record<string, CellStyle>;
}

/** Загружает Excel-секцию шаблона протокола (шапка и стили ячеек). */
export const useProtocolTemplateExcelSection = (
  templateId: number,
  section: string,
  enabled = true
) => {
  return useAutoRefetchQuery<ProtocolTemplateExcelSectionData>(
    protocolKeys.templates.excelSection(templateId, section),
    async () => {
      const stylesResponse = await protocolsApi.getExcelStyles(templateId, section);
      const styles = normalizeCellStyles(stylesResponse.styles);
      const fileResponse = await protocolsApi.getProtocolTemplateFile(templateId, section);
      const { headerData } = await parseProtocolTemplateHeader(fileResponse);

      return { headerData, styles };
    },
    {
      enabled: enabled && !!templateId && !!section,
      refetchInterval: false,
      refetchOnWindowFocus: false,
    }
  );
};

/** Скачивает файл секции шаблона протокола. */
export const downloadProtocolTemplateFile = async (
  templateId: number,
  section: string
): Promise<ArrayBuffer> => {
  return protocolsApi.getProtocolTemplateFile(templateId, section);
};
