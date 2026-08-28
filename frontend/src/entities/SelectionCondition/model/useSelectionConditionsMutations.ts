import { notify } from '@/shared/lib/notify';
import { useAutoInvalidateMutation } from '@/shared/model';
import {
  selectionConditionKeys,
  type SelectionConditions,
  selectionConditionsApi,
  type SelectionConditionsCreate,
  type SelectionConditionsUpdate,
} from '../api';

/** Создаёт условия отбора. */
export const useCreateSelectionConditions = () => {
  return useAutoInvalidateMutation<SelectionConditions, unknown, SelectionConditionsCreate>(
    data => selectionConditionsApi.createSelectionConditions(data),
    [selectionConditionKeys.all],
    {
      onSuccess: () => {
        notify.success('Условия отбора успешно добавлены');
      },
    }
  );
};

/** Обновляет условия отбора. */
export const useUpdateSelectionConditions = () => {
  return useAutoInvalidateMutation<
    SelectionConditions,
    unknown,
    { id: number; data: SelectionConditionsUpdate }
  >(
    ({ id, data }) => selectionConditionsApi.updateSelectionConditions(id, data),
    [selectionConditionKeys.all],
    {
      onSuccess: () => {
        notify.success('Условия отбора успешно обновлены');
      },
    }
  );
};
