import { notify } from '@/shared/lib/notify';
import { useAutoInvalidateMutation } from '@/shared/model';
import { type NdNorm, type NdNormCreate, ndNormKeys, ndNormsApi, type NdNormUpdate } from '../api';

/** Создаёт норму НД. */
export const useCreateNdNorm = () => {
  return useAutoInvalidateMutation<NdNorm, unknown, NdNormCreate>(
    data => ndNormsApi.createNdNorm(data),
    [ndNormKeys.all],
    {
      onSuccess: () => {
        notify.success('Норма НД успешно добавлена');
      },
    }
  );
};

/** Обновляет норму НД. */
export const useUpdateNdNorm = () => {
  return useAutoInvalidateMutation<NdNorm, unknown, { id: number; data: NdNormUpdate }>(
    ({ id, data }) => ndNormsApi.updateNdNorm(id, data),
    [ndNormKeys.all],
    {
      onSuccess: () => {
        notify.success('Норма НД успешно обновлена');
      },
    }
  );
};

/** Удаляет норму НД. */
export const useDeleteNdNorm = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => ndNormsApi.deleteNdNorm(id),
    [ndNormKeys.all],
    {
      onSuccess: () => {
        notify.success('Норма НД успешно удалена');
      },
    }
  );
};
