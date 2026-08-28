import { notify } from '@/shared/lib/notify';
import { useAutoInvalidateMutation } from '@/shared/model';
import {
  type WellMode,
  type WellModeCreate,
  type WellModeUpdate,
  wellModeKeys,
  wellModesApi,
} from '../api';

/** Создаёт режим скважины. */
export const useCreateWellMode = () => {
  return useAutoInvalidateMutation<WellMode, unknown, WellModeCreate>(
    data => wellModesApi.createWellMode(data),
    [wellModeKeys.all],
    {
      onSuccess: () => {
        notify.success('Режим скважины успешно добавлен');
      },
    }
  );
};

/** Обновляет режим скважины. */
export const useUpdateWellMode = () => {
  return useAutoInvalidateMutation<WellMode, unknown, { id: number; data: WellModeUpdate }>(
    ({ id, data }) => wellModesApi.updateWellMode(id, data),
    [wellModeKeys.all],
    {
      onSuccess: () => {
        notify.success('Режим скважины успешно обновлён');
      },
    }
  );
};

/** Удаляет режим скважины. */
export const useDeleteWellMode = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => wellModesApi.deleteWellMode(id),
    [wellModeKeys.all],
    {
      onSuccess: () => {
        notify.success('Режим скважины успешно удалён');
      },
    }
  );
};
