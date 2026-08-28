import { extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';
import { useAutoInvalidateMutation } from '@/shared/model';
import {
  type Protocol,
  type ProtocolCreate,
  protocolKeys,
  protocolsApi,
  type ProtocolTemplate,
  type ProtocolUpdate,
} from '../api';

/** Создаёт протокол. */
export const useCreateProtocol = () => {
  return useAutoInvalidateMutation<Protocol, unknown, ProtocolCreate>(
    data => protocolsApi.createProtocol(data),
    [protocolKeys.all],
    {
      onSuccess: () => {
        notify.success('Протокол успешно добавлен');
      },
    }
  );
};

/** Обновляет протокол. */
export const useUpdateProtocol = () => {
  return useAutoInvalidateMutation<Protocol, unknown, { id: number; data: ProtocolUpdate }>(
    ({ id, data }) => protocolsApi.updateProtocol(id, data),
    [protocolKeys.all],
    {
      onSuccess: () => {
        notify.success('Протокол успешно обновлён');
      },
    }
  );
};

/** Удаляет протокол. */
export const useDeleteProtocol = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => protocolsApi.deleteProtocol(id),
    [protocolKeys.all],
    {
      onSuccess: () => {
        notify.success('Протокол успешно удалён');
      },
    }
  );
};

/** Формирует Excel-файл протокола. */
export const useGenerateProtocolExcel = () => {
  return useAutoInvalidateMutation<{ blob: Blob; filename: string }, unknown, number>(
    protocolId => protocolsApi.generateProtocolExcel(protocolId),
    [],
    {
      onSuccess: () => {
        notify.success('Протокол успешно сформирован');
      },
      onError: error => {
        notify.error(extractErrorMessage(error, 'Ошибка при формировании протокола'));
      },
    }
  );
};

type CreateProtocolTemplateVariables = {
  name: string;
  file_name: string;
  file: string;
  laboratory_id: number;
  department_id?: number;
};

/** Создаёт шаблон протокола. */
export const useCreateProtocolTemplate = () => {
  return useAutoInvalidateMutation<ProtocolTemplate, unknown, CreateProtocolTemplateVariables>(
    data => protocolsApi.createProtocolTemplate(data),
    [protocolKeys.templates.all]
  );
};

/** Сохраняет секцию Excel шаблона протокола. */
export const useSaveProtocolTemplateExcelSection = () => {
  return useAutoInvalidateMutation<{ template_id?: number; error?: string }, unknown, FormData>(
    formData => protocolsApi.saveExcelSection(formData),
    [protocolKeys.templates.all]
  );
};
