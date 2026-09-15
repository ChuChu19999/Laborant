import { notify } from '@/shared/lib/notify';
import { useAutoInvalidateMutation } from '@/shared/model';
import {
  type TestPurpose,
  type TestPurposeCreate,
  type TestPurposeUpdate,
  testPurposeKeys,
  testPurposesApi,
} from '../api';

/** Создаёт цель испытаний. */
export const useCreateTestPurpose = () => {
  return useAutoInvalidateMutation<TestPurpose, unknown, TestPurposeCreate>(
    data => testPurposesApi.createTestPurpose(data),
    [testPurposeKeys.all],
    {
      onSuccess: () => {
        notify.success('Цель испытаний успешно добавлена');
      },
    }
  );
};

/** Обновляет цель испытаний. */
export const useUpdateTestPurpose = () => {
  return useAutoInvalidateMutation<TestPurpose, unknown, { id: number; data: TestPurposeUpdate }>(
    ({ id, data }) => testPurposesApi.updateTestPurpose(id, data),
    [testPurposeKeys.all],
    {
      onSuccess: () => {
        notify.success('Цель испытаний успешно обновлена');
      },
    }
  );
};

/** Удаляет цель испытаний. */
export const useDeleteTestPurpose = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => testPurposesApi.deleteTestPurpose(id),
    [testPurposeKeys.all],
    {
      onSuccess: () => {
        notify.success('Цель испытаний успешно удалена');
      },
    }
  );
};
