import { notify } from '@/shared/lib/notify';
import { useAutoInvalidateMutation } from '@/shared/model';
import { type RoleCatalogItem, type RoleCreate, roleKeys, rolesApi, type RoleUpdate } from '../api';

/** Создаёт роль. */
export const useCreateRole = () => {
  return useAutoInvalidateMutation<RoleCatalogItem, unknown, RoleCreate>(
    data => rolesApi.createRole(data),
    [roleKeys.all],
    {
      onSuccess: () => {
        notify.success('Роль успешно добавлена');
      },
    }
  );
};

/** Обновляет роль. */
export const useUpdateRole = () => {
  return useAutoInvalidateMutation<RoleCatalogItem, unknown, { id: number; data: RoleUpdate }>(
    ({ id, data }) => rolesApi.updateRole(id, data),
    [roleKeys.all],
    {
      onSuccess: () => {
        notify.success('Роль успешно обновлена');
      },
    }
  );
};

/** Удаляет роль. */
export const useDeleteRole = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => rolesApi.deleteRole(id),
    [roleKeys.all],
    {
      onSuccess: () => {
        notify.success('Роль успешно удалена');
      },
    }
  );
};
