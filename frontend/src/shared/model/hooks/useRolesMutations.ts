import { message } from 'antd';
import { rolesApi, type RoleCatalogItem, type RoleCreate, type RoleUpdate } from '../../api/roles';
import { useAutoInvalidateMutation } from '../lib/useMutation';

export const useCreateRole = () => {
  return useAutoInvalidateMutation<RoleCatalogItem, unknown, RoleCreate>(
    data => rolesApi.createRole(data),
    [['roles']],
    {
      onSuccess: () => {
        message.success('Роль успешно добавлена');
      },
    }
  );
};

export const useUpdateRole = () => {
  return useAutoInvalidateMutation<RoleCatalogItem, unknown, { id: number; data: RoleUpdate }>(
    ({ id, data }) => rolesApi.updateRole(id, data),
    [['roles']],
    {
      onSuccess: () => {
        message.success('Роль успешно обновлена');
      },
    }
  );
};

export const useDeleteRole = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => rolesApi.deleteRole(id),
    [['roles']],
    {
      onSuccess: () => {
        message.success('Роль успешно удалена');
      },
    }
  );
};
