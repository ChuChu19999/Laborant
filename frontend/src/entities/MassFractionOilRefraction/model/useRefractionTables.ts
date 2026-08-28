import { useAutoRefetchQuery } from '@/shared/model';
import {
  type MassFractionOilRefractionTable,
  refractionTableKeys,
  refractionTablesApi,
} from '../api';
import type { PaginatedResponse } from '@/shared/lib/http';

/** Загружает точки градуировочного графика по методике. */
export const useRefractionTablesByMethod = (
  researchMethodId: number | undefined,
  enabled = true
) => {
  return useAutoRefetchQuery<PaginatedResponse<MassFractionOilRefractionTable>>(
    refractionTableKeys.byMethod(researchMethodId),
    () =>
      refractionTablesApi.getRefractionTables(
        researchMethodId,
        undefined,
        undefined,
        'c_value',
        'asc'
      ),
    { enabled: enabled && !!researchMethodId }
  );
};
