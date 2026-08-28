export const employeeKeys = {
  all: ['employees'] as const,
  details: () => [...employeeKeys.all, 'detail'] as const,
  detail: (hsnils: string, withPhoto: boolean) =>
    [...employeeKeys.details(), hsnils, withPhoto] as const,
  byHsnils: (hsnils: readonly string[]) =>
    [...employeeKeys.all, 'by-hsnils', ...[...hsnils].sort()] as const,
  search: (searchFio: string, laboratoryName?: string) =>
    [...employeeKeys.all, 'search', searchFio, laboratoryName ?? ''] as const,
};
