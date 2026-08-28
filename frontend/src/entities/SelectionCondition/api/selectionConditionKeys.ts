export const selectionConditionKeys = {
  all: ['selection-conditions'] as const,
  lists: () => [...selectionConditionKeys.all, 'list'] as const,
  list: (laboratoryId: number | undefined, departmentId: number | undefined) =>
    [...selectionConditionKeys.lists(), laboratoryId, departmentId] as const,
  fields: (laboratoryId: number | undefined, departmentId: number | undefined) =>
    [...selectionConditionKeys.all, 'fields', laboratoryId, departmentId] as const,
};
