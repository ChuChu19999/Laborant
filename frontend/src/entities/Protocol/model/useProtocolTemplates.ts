import { useAutoRefetchQuery } from '@/shared/model';
import { protocolKeys, protocolsApi, type ProtocolTemplate } from '../api';

/** Загружает доступные шаблоны протоколов для создания. */
export const useAvailableProtocolTemplates = (
  laboratoryId: number | undefined,
  departmentId: number | undefined,
  enabled = true
) => {
  const isQueryEnabled = enabled && laboratoryId != null;
  return useAutoRefetchQuery<ProtocolTemplate[]>(
    protocolKeys.templates.available(laboratoryId, departmentId),
    () => {
      if (laboratoryId == null) {
        return Promise.reject(new Error('Laboratory id is required'));
      }
      return protocolsApi.getAvailableProtocolTemplates(laboratoryId, departmentId);
    },
    { enabled: isQueryEnabled }
  );
};

/** Загружает шаблон протокола по идентификатору. */
export const useProtocolTemplate = (templateId: number | null | undefined, enabled = true) => {
  const isQueryEnabled = enabled && templateId != null;
  return useAutoRefetchQuery<ProtocolTemplate>(
    protocolKeys.templates.detail(templateId),
    () => {
      if (templateId == null) {
        return Promise.reject(new Error('Protocol template id is required'));
      }
      return protocolsApi.getProtocolTemplate(templateId);
    },
    { enabled: isQueryEnabled }
  );
};
