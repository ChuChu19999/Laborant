import { message } from 'antd';
import {
  equipmentApi,
  type Equipment,
  type EquipmentCreate,
  type EquipmentUpdate,
} from '../../api/equipment';
import { useAutoInvalidateMutation } from '../lib/useMutation';

export const useCreateEquipment = () => {
  return useAutoInvalidateMutation<Equipment, unknown, EquipmentCreate>(
    data => equipmentApi.createEquipment(data),
    [['equipment']],
    {
      onSuccess: () => {
        message.success('Прибор успешно добавлен');
      },
    }
  );
};

export const useUpdateEquipment = () => {
  return useAutoInvalidateMutation<Equipment, unknown, { id: number; data: EquipmentUpdate }>(
    ({ id, data }) => equipmentApi.updateEquipment(id, data),
    [['equipment']],
    {
      onSuccess: () => {
        message.success('Прибор успешно обновлен');
      },
    }
  );
};

export const useDeleteEquipment = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => equipmentApi.deleteEquipment(id),
    [['equipment']],
    {
      onSuccess: () => {
        message.success('Прибор успешно удален');
      },
    }
  );
};
