import { useAutoRefetchQuery } from '@/shared/model';
import {
  selectionConditionKeys,
  selectionConditionsApi,
  type SelectionConditions,
  type SelectionConditionsField,
} from '../api';
import type { PaginatedResponse } from '@/shared/lib/http';

export const useSelectionConditions = (
  laboratoryId: number | undefined,
  departmentId: number | undefined,
  enabled = true
) => {
  return useAutoRefetchQuery<PaginatedResponse<SelectionConditions>>(
    selectionConditionKeys.list(laboratoryId, departmentId),
    () => selectionConditionsApi.getSelectionConditions(laboratoryId, departmentId),
    { enabled: enabled && !!laboratoryId }
  );
};

/** Загружает поля условий отбора для форм создания и редактирования пробы. */
export const useSelectionConditionsFields = (
  laboratoryId: number | undefined,
  departmentId: number | undefined,
  enabled = true
) => {
  const isQueryEnabled = enabled && laboratoryId != null;
  return useAutoRefetchQuery<SelectionConditionsField[]>(
    selectionConditionKeys.fields(laboratoryId, departmentId),
    () => {
      if (laboratoryId == null) {
        return Promise.reject(new Error('Laboratory id is required'));
      }
      return selectionConditionsApi.getSelectionConditionsFields(laboratoryId, departmentId);
    },
    { enabled: isQueryEnabled }
  );
};
