export const departmentKeys = {
  all: ['departments'] as const,
  byLaboratory: (laboratoryId: number | undefined) =>
    [...departmentKeys.all, 'by-laboratory', laboratoryId] as const,
};
