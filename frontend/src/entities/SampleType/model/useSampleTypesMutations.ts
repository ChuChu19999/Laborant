import { notify } from '@/shared/lib/notify';
import { useAutoInvalidateMutation } from '@/shared/model';
import {
  type SampleType,
  type SampleTypeCreate,
  type SampleTypeUpdate,
  sampleTypeKeys,
  sampleTypesApi,
} from '../api';

/** Создаёт тип пробы. */
export const useCreateSampleType = () => {
  return useAutoInvalidateMutation<SampleType, unknown, SampleTypeCreate>(
    data => sampleTypesApi.createSampleType(data),
    [sampleTypeKeys.all],
    {
      onSuccess: () => {
        notify.success('Тип пробы успешно добавлен');
      },
    }
  );
};

/** Обновляет тип пробы. */
export const useUpdateSampleType = () => {
  return useAutoInvalidateMutation<SampleType, unknown, { id: number; data: SampleTypeUpdate }>(
    ({ id, data }) => sampleTypesApi.updateSampleType(id, data),
    [sampleTypeKeys.all],
    {
      onSuccess: () => {
        notify.success('Тип пробы успешно обновлён');
      },
    }
  );
};

/** Удаляет тип пробы. */
export const useDeleteSampleType = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => sampleTypesApi.deleteSampleType(id),
    [sampleTypeKeys.all],
    {
      onSuccess: () => {
        notify.success('Тип пробы успешно удалён');
      },
    }
  );
};
