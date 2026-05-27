import { message } from 'antd';
import {
  testObjectsApi,
  type TestObjectCatalogItem,
  type TestObjectCreate,
  type TestObjectUpdate,
} from '../../api/testObjects';
import { useAutoInvalidateMutation } from '../lib/useMutation';

export const useCreateTestObject = () => {
  return useAutoInvalidateMutation<TestObjectCatalogItem, unknown, TestObjectCreate>(
    data => testObjectsApi.createTestObject(data),
    [['test-objects']],
    {
      onSuccess: () => {
        message.success('Объект испытаний успешно добавлен');
      },
    }
  );
};

export const useUpdateTestObject = () => {
  return useAutoInvalidateMutation<
    TestObjectCatalogItem,
    unknown,
    { id: number; data: TestObjectUpdate }
  >(({ id, data }) => testObjectsApi.updateTestObject(id, data), [['test-objects']], {
    onSuccess: () => {
      message.success('Объект испытаний успешно обновлен');
    },
  });
};

export const useDeleteTestObject = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => testObjectsApi.deleteTestObject(id),
    [['test-objects']],
    {
      onSuccess: () => {
        message.success('Объект испытаний успешно удален');
      },
    }
  );
};
