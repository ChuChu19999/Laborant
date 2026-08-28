import { notify } from '@/shared/lib/notify';
import { useAutoInvalidateMutation } from '@/shared/model';
import {
  type TestObjectCatalogItem,
  type TestObjectCreate,
  testObjectKeys,
  testObjectsApi,
  type TestObjectUpdate,
} from '../api';

/** Создаёт объект испытаний. */
export const useCreateTestObject = () => {
  return useAutoInvalidateMutation<TestObjectCatalogItem, unknown, TestObjectCreate>(
    data => testObjectsApi.createTestObject(data),
    [testObjectKeys.all],
    {
      onSuccess: () => {
        notify.success('Объект испытаний успешно добавлен');
      },
    }
  );
};

/** Обновляет объект испытаний. */
export const useUpdateTestObject = () => {
  return useAutoInvalidateMutation<
    TestObjectCatalogItem,
    unknown,
    { id: number; data: TestObjectUpdate }
  >(({ id, data }) => testObjectsApi.updateTestObject(id, data), [testObjectKeys.all], {
    onSuccess: () => {
      notify.success('Объект испытаний успешно обновлён');
    },
  });
};

/** Удаляет объект испытаний. */
export const useDeleteTestObject = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => testObjectsApi.deleteTestObject(id),
    [testObjectKeys.all],
    {
      onSuccess: () => {
        notify.success('Объект испытаний успешно удалён');
      },
    }
  );
};
