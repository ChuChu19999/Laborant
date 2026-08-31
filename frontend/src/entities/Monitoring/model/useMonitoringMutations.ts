import { notify } from '@/shared/lib/notify';
import { useAutoInvalidateMutation } from '@/shared/model';
import { monitoringApi, monitoringKeys } from '../api';

interface UpdateMonitoringErrorStatusPayload {
  errorId: number;
  resolved: boolean;
  comment?: string | null;
}

/** Изменить статус ошибки мониторинга (открыта / закрыта). */
export const useUpdateMonitoringErrorStatus = () => {
  return useAutoInvalidateMutation(
    ({ errorId, resolved, comment }: UpdateMonitoringErrorStatusPayload) =>
      monitoringApi.updateErrorStatus(errorId, resolved, comment),
    [monitoringKeys.errors(), monitoringKeys.all],
    {
      onSuccess: (_, variables) => {
        notify.success(variables.resolved ? 'Ошибка успешно закрыта' : 'Ошибка успешно открыта');
      },
    }
  );
};

/** Удалить закрытые ошибки старше 90 дней. */
export const useCleanupClosedMonitoringErrors = () => {
  return useAutoInvalidateMutation(
    () => monitoringApi.cleanupClosedErrors(),
    [monitoringKeys.errors(), monitoringKeys.all],
    {
      onSuccess: data => {
        notify.success(data.message);
      },
    }
  );
};
