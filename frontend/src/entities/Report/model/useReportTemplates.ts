import { useAutoRefetchQuery } from '@/shared/model';
import { reportKeys, reportsApi, type ReportTemplate } from '../api';

/** Загружает доступные шаблоны отчётов для select (без пагинации). */
export const useAvailableReportTemplates = (
  laboratoryId: number | undefined,
  departmentId: number | undefined,
  enabled = true
) => {
  const isQueryEnabled = enabled && laboratoryId != null;
  return useAutoRefetchQuery<ReportTemplate[]>(
    reportKeys.available(laboratoryId, departmentId),
    () => {
      if (laboratoryId == null) {
        return Promise.reject(new Error('Laboratory id is required'));
      }
      return reportsApi.getAvailableReportTemplates(laboratoryId, departmentId);
    },
    { enabled: isQueryEnabled }
  );
};

/** Загружает один шаблон отчёта по идентификатору. */
export const useReportTemplate = (templateId: number | null | undefined, enabled = true) => {
  const isQueryEnabled = enabled && templateId != null;
  return useAutoRefetchQuery<ReportTemplate>(
    reportKeys.detail(templateId),
    () => {
      if (templateId == null) {
        return Promise.reject(new Error('Report template id is required'));
      }
      return reportsApi.getReportTemplate(templateId);
    },
    { enabled: isQueryEnabled }
  );
};
