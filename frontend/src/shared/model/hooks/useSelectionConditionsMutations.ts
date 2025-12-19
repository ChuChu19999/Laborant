import { message } from 'antd';
import {
  selectionConditionsApi,
  type SelectionConditions,
  type SelectionConditionsCreate,
  type SelectionConditionsUpdate,
} from '../../api/selectionConditions';
import { useAutoInvalidateMutation } from '../lib/useMutation';

export const useCreateSelectionConditions = () => {
  return useAutoInvalidateMutation<SelectionConditions, unknown, SelectionConditionsCreate>(
    data => selectionConditionsApi.createSelectionConditions(data),
    [['selection-conditions']],
    {
      onSuccess: () => {
        message.success('Условия отбора успешно созданы');
      },
    }
  );
};

export const useUpdateSelectionConditions = () => {
  return useAutoInvalidateMutation<
    SelectionConditions,
    unknown,
    { id: number; data: SelectionConditionsUpdate }
  >(
    ({ id, data }) => selectionConditionsApi.updateSelectionConditions(id, data),
    [['selection-conditions']],
    {
      onSuccess: () => {
        message.success('Условия отбора успешно обновлены');
      },
    }
  );
};

export const useDeleteSelectionConditions = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => selectionConditionsApi.deleteSelectionConditions(id),
    [['selection-conditions']],
    {
      onSuccess: () => {
        message.success('Условия отбора успешно удалены');
      },
    }
  );
};
