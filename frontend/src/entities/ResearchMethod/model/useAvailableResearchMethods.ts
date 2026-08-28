import { useAutoRefetchQuery } from '@/shared/model';
import { researchApi, researchMethodKeys } from '../api';

type AvailableResearchMethodsParams = {
  laboratory_id: number;
  department_id?: number;
  sample_id?: number;
};

type AvailableResearchMethodsResponse = Awaited<
  ReturnType<typeof researchApi.getAvailableResearchMethods>
>;

/** Загружает доступные методы исследования для расчёта. */
export const useAvailableResearchMethods = (
  params: AvailableResearchMethodsParams | undefined,
  enabled = true
) => {
  const laboratoryId = params?.laboratory_id;
  const departmentId = params?.department_id;
  const sampleId = params?.sample_id;

  const isQueryEnabled = enabled && !!laboratoryId;

  return useAutoRefetchQuery<AvailableResearchMethodsResponse>(
    researchMethodKeys.available(laboratoryId, departmentId, sampleId),
    () => {
      if (params == null) {
        return Promise.reject(new Error('Available research methods params are required'));
      }
      return researchApi.getAvailableResearchMethods(params);
    },
    {
      enabled: isQueryEnabled,
      refetchInterval: false,
    }
  );
};
