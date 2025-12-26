import { message } from 'antd';
import { samplesApi, type Sample, type SampleCreate, type SampleUpdate } from '../../api/samples';
import { useAutoInvalidateMutation } from '../lib/useMutation';

export const useCreateSample = () => {
  return useAutoInvalidateMutation<Sample, unknown, SampleCreate>(
    data => samplesApi.createSample(data),
    [['samples']],
    {
      onSuccess: () => {
        message.success('Проба успешно добавлена');
      },
    }
  );
};

export const useUpdateSample = () => {
  return useAutoInvalidateMutation<Sample, unknown, { id: number; data: SampleUpdate }>(
    ({ id, data }) => samplesApi.updateSample(id, data),
    [['samples']],
    {
      onSuccess: () => {
        message.success('Проба успешно обновлена');
      },
    }
  );
};

export const useDeleteSample = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => samplesApi.deleteSample(id),
    [['samples']],
    {
      onSuccess: () => {
        message.success('Проба успешно удалена');
      },
    }
  );
};
