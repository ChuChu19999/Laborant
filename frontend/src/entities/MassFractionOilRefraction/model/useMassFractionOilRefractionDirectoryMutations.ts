import { notify } from '@/shared/lib/notify';
import { useAutoInvalidateMutation } from '@/shared/model';
import { type BulkUpdateRequest, refractionTableKeys, refractionTablesApi } from '../api';

/** Массово обновляет градуировочный график. */
export const useBulkUpdateMassFractionOilRefractionTable = () => {
  return useAutoInvalidateMutation<{ message: string }, unknown, BulkUpdateRequest>(
    data => refractionTablesApi.bulkUpdate(data),
    [refractionTableKeys.all],
    {
      onSuccess: () => {
        notify.success('Градуировочный график успешно обновлён');
      },
    }
  );
};
