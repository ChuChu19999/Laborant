import { extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';
import { useAutoInvalidateMutation } from '@/shared/model';
import {
  type Sample,
  type SampleCreate,
  type SampleFilters,
  sampleKeys,
  samplesApi,
  type SampleUpdate,
} from '../api';

/** Создаёт пробу. */
export const useCreateSample = () => {
  return useAutoInvalidateMutation<Sample, unknown, SampleCreate>(
    data => samplesApi.createSample(data),
    [sampleKeys.all],
    {
      onSuccess: () => {
        notify.success('Проба успешно добавлена');
      },
    }
  );
};

/** Обновляет пробу. */
export const useUpdateSample = () => {
  return useAutoInvalidateMutation<Sample, unknown, { id: number; data: SampleUpdate }>(
    ({ id, data }) => samplesApi.updateSample(id, data),
    [sampleKeys.all],
    {
      onSuccess: () => {
        notify.success('Проба успешно обновлена');
      },
    }
  );
};

/** Удаляет пробу. */
export const useDeleteSample = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => samplesApi.deleteSample(id),
    [sampleKeys.all],
    {
      onSuccess: () => {
        notify.success('Проба успешно удалена');
      },
    }
  );
};

type ExportSamplesVariables = {
  filters?: SampleFilters;
  sorting?: { sort_by?: string; sort_order?: 'asc' | 'desc' };
  laboratoryId?: number;
  departmentId?: number;
};

/** Экспортирует таблицу проб в Excel. */
export const useExportSamples = () => {
  return useAutoInvalidateMutation<
    { blob: Blob; filename: string; total: number | null },
    unknown,
    ExportSamplesVariables
  >(
    ({ filters, sorting, laboratoryId, departmentId }) =>
      samplesApi.exportSamples(filters, sorting, laboratoryId, departmentId),
    [],
    {
      onError: error => {
        const errorMessage = extractErrorMessage(error, 'Не удалось сохранить таблицу');
        if (errorMessage.includes('Нет данных для экспорта')) {
          notify.info(errorMessage);
        } else {
          notify.error(errorMessage);
        }
      },
    }
  );
};
