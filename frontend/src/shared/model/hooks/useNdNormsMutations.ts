import { message } from 'antd';
import { ndNormsApi, type NdNorm, type NdNormCreate, type NdNormUpdate } from '../../api/ndNorms';
import { useAutoInvalidateMutation } from '../lib/useMutation';

export const useCreateNdNorm = () => {
  return useAutoInvalidateMutation<NdNorm, unknown, NdNormCreate>(
    data => ndNormsApi.createNdNorm(data),
    [['nd-norms']],
    {
      onSuccess: () => {
        message.success('Норма НД успешно добавлена');
      },
    }
  );
};

export const useUpdateNdNorm = () => {
  return useAutoInvalidateMutation<NdNorm, unknown, { id: number; data: NdNormUpdate }>(
    ({ id, data }) => ndNormsApi.updateNdNorm(id, data),
    [['nd-norms']],
    {
      onSuccess: () => {
        message.success('Норма НД успешно обновлена');
      },
    }
  );
};

export const useDeleteNdNorm = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => ndNormsApi.deleteNdNorm(id),
    [['nd-norms']],
    {
      onSuccess: () => {
        message.success('Норма НД успешно удалена');
      },
    }
  );
};
