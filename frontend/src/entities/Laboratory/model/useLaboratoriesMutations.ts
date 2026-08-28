import { departmentKeys } from '@/entities/Department/@x/Laboratory';
import { notify } from '@/shared/lib/notify';
import { useAutoInvalidateMutation } from '@/shared/model';
import {
  type Laboratory,
  type LaboratoryCreate,
  type LaboratoryUpdate,
  laboratoriesApi,
  laboratoryKeys,
} from '../api';

/** Создаёт лабораторию. */
export const useCreateLaboratory = () => {
  return useAutoInvalidateMutation<Laboratory, unknown, LaboratoryCreate>(
    data => laboratoriesApi.createLaboratory(data),
    [laboratoryKeys.all],
    {
      onSuccess: () => {
        notify.success('Лаборатория успешно добавлена');
      },
    }
  );
};

/** Обновляет лабораторию. */
export const useUpdateLaboratory = () => {
  return useAutoInvalidateMutation<Laboratory, unknown, { id: number; data: LaboratoryUpdate }>(
    ({ id, data }) => laboratoriesApi.updateLaboratory(id, data),
    [laboratoryKeys.all],
    {
      onSuccess: () => {
        notify.success('Лаборатория успешно обновлена');
      },
    }
  );
};

/** Удаляет лабораторию и связанные подразделения. */
export const useDeleteLaboratory = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => laboratoriesApi.deleteLaboratory(id),
    [laboratoryKeys.all, departmentKeys.all],
    {
      onSuccess: () => {
        notify.success('Лаборатория успешно удалена');
      },
    }
  );
};
