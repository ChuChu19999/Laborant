import { notify } from '@/shared/lib/notify';
import { useAutoInvalidateMutation } from '@/shared/model';
import {
  type Department,
  type DepartmentCreate,
  type DepartmentUpdate,
  departmentKeys,
  departmentsApi,
} from '../api';

/** Создаёт подразделение. */
export const useCreateDepartment = () => {
  return useAutoInvalidateMutation<Department, unknown, DepartmentCreate>(
    data => departmentsApi.createDepartment(data),
    [departmentKeys.all],
    {
      onSuccess: () => {
        notify.success('Подразделение успешно добавлено');
      },
    }
  );
};

/** Обновляет подразделение. */
export const useUpdateDepartment = () => {
  return useAutoInvalidateMutation<Department, unknown, { id: number; data: DepartmentUpdate }>(
    ({ id, data }) => departmentsApi.updateDepartment(id, data),
    [departmentKeys.all],
    {
      onSuccess: () => {
        notify.success('Подразделение успешно обновлено');
      },
    }
  );
};

/** Удаляет подразделение. */
export const useDeleteDepartment = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => departmentsApi.deleteDepartment(id),
    [departmentKeys.all],
    {
      onSuccess: () => {
        notify.success('Подразделение успешно удалено');
      },
    }
  );
};
