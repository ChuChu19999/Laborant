export const monitoringKeys = {
  all: ['monitoring'] as const,
  overviews: () => [...monitoringKeys.all, 'overview'] as const,
  overview: (period: string) => [...monitoringKeys.overviews(), period] as const,
  errors: () => [...monitoringKeys.all, 'errors'] as const,
  errorsList: (page: number, pageSize: number, filters: object, sorting: object) =>
    [...monitoringKeys.errors(), page, pageSize, filters, sorting] as const,
};
