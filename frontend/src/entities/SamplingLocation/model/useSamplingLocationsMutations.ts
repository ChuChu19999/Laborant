import { notify } from '@/shared/lib/notify';
import { useAutoInvalidateMutation } from '@/shared/model';
import {
  type SamplingLocation,
  type SamplingLocationCreate,
  samplingLocationKeys,
  samplingLocationsApi,
  type SamplingLocationUpdate,
} from '../api';

/** Создаёт место отбора пробы. */
export const useCreateSamplingLocation = () => {
  return useAutoInvalidateMutation<SamplingLocation, unknown, SamplingLocationCreate>(
    data => samplingLocationsApi.createSamplingLocation(data),
    [samplingLocationKeys.all],
    {
      onSuccess: () => {
        notify.success('Место отбора пробы успешно добавлено');
      },
    }
  );
};

/** Обновляет место отбора пробы. */
export const useUpdateSamplingLocation = () => {
  return useAutoInvalidateMutation<
    SamplingLocation,
    unknown,
    { id: number; data: SamplingLocationUpdate }
  >(
    ({ id, data }) => samplingLocationsApi.updateSamplingLocation(id, data),
    [samplingLocationKeys.all],
    {
      onSuccess: () => {
        notify.success('Место отбора пробы успешно обновлено');
      },
    }
  );
};

/** Удаляет место отбора пробы. */
export const useDeleteSamplingLocation = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => samplingLocationsApi.deleteSamplingLocation(id),
    [samplingLocationKeys.all],
    {
      onSuccess: () => {
        notify.success('Место отбора пробы успешно удалено');
      },
    }
  );
};
