import { notify } from '@/shared/lib/notify';
import { useAutoInvalidateMutation } from '@/shared/model';
import {
  type Equipment,
  equipmentApi,
  type EquipmentCreate,
  equipmentKeys,
  type EquipmentUpdate,
} from '../api';

/** Создаёт прибор. */
export const useCreateEquipment = () => {
  return useAutoInvalidateMutation<Equipment, unknown, EquipmentCreate>(
    data => equipmentApi.createEquipment(data),
    [equipmentKeys.all],
    {
      onSuccess: () => {
        notify.success('Прибор успешно добавлен');
      },
    }
  );
};

/** Обновляет прибор. */
export const useUpdateEquipment = () => {
  return useAutoInvalidateMutation<Equipment, unknown, { id: number; data: EquipmentUpdate }>(
    ({ id, data }) => equipmentApi.updateEquipment(id, data),
    [equipmentKeys.all],
    {
      onSuccess: () => {
        notify.success('Прибор успешно обновлён');
      },
    }
  );
};

/** Удаляет прибор. */
export const useDeleteEquipment = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => equipmentApi.deleteEquipment(id),
    [equipmentKeys.all],
    {
      onSuccess: () => {
        notify.success('Прибор успешно удалён');
      },
    }
  );
};
