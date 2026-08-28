import { useMemo } from 'react';
import { useAutoRefetchQuery } from '@/shared/model';
import { type EmployeeBrief, employeeKeys, employeesApi } from '../api';

/** Загружает сотрудника по hsnils. */
export const useEmployeeByHsnils = (
  hsnils: string | undefined,
  withPhoto = false,
  enabled = true
) => {
  const normalized = hsnils?.trim() ?? '';

  return useAutoRefetchQuery<EmployeeBrief | null>(
    employeeKeys.detail(normalized, withPhoto),
    () => employeesApi.getByHsnils(normalized, withPhoto),
    {
      enabled: enabled && normalized.length > 0,
      refetchInterval: false,
      refetchOnWindowFocus: false,
    }
  );
};

export const useEmployeesByHsnils = (hsnilsList: readonly string[], enabled = true) => {
  const sortedHsnils = useMemo(() => [...new Set(hsnilsList.filter(Boolean))].sort(), [hsnilsList]);

  return useAutoRefetchQuery<Record<string, EmployeeBrief>>(
    employeeKeys.byHsnils(sortedHsnils),
    () => employeesApi.getByHsnilsList(sortedHsnils, false),
    { enabled: enabled && sortedHsnils.length > 0 }
  );
};

export const useEmployeeSearch = (searchFio: string, laboratoryName?: string, enabled = true) => {
  const canSearch = searchFio.length >= 3;

  return useAutoRefetchQuery<EmployeeBrief[]>(
    employeeKeys.search(searchFio, laboratoryName),
    () =>
      laboratoryName
        ? employeesApi.searchByFioAndLaboratory(searchFio, laboratoryName, true)
        : employeesApi.searchByFio(searchFio, true),
    {
      enabled: enabled && canSearch,
      refetchInterval: false,
      refetchOnWindowFocus: false,
    }
  );
};
