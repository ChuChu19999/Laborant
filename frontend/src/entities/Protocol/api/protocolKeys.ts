export const protocolKeys = {
  all: ['protocols'] as const,
  lists: () => [...protocolKeys.all, 'list'] as const,
  list: (
    laboratoryId: number | undefined,
    departmentId: number | undefined,
    page: number,
    pageSize: number,
    filters: unknown,
    sorting: unknown
  ) =>
    [
      ...protocolKeys.lists(),
      laboratoryId,
      departmentId,
      page,
      pageSize,
      filters,
      sorting,
    ] as const,
  details: () => [...protocolKeys.all, 'detail'] as const,
  detail: (id: number) => [...protocolKeys.details(), id] as const,
  templates: {
    all: ['protocol-templates'] as const,
    lists: () => [...protocolKeys.templates.all, 'list'] as const,
    list: (laboratoryId: number | undefined, departmentId: number | undefined) =>
      [...protocolKeys.templates.lists(), laboratoryId, departmentId] as const,
    available: (laboratoryId: number | undefined, departmentId: number | undefined) =>
      [...protocolKeys.templates.all, 'available', laboratoryId, departmentId] as const,
    details: () => [...protocolKeys.templates.all, 'detail'] as const,
    detail: (id: number | null | undefined) => [...protocolKeys.templates.details(), id] as const,
    excelSection: (templateId: number, section: string) =>
      [...protocolKeys.templates.all, 'excel-section', templateId, section] as const,
  },
};
