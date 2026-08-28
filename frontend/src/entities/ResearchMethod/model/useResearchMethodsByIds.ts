import { useMemo } from 'react';
import { useAutoRefetchQuery } from '@/shared/model';
import { researchApi, type ResearchMethod, researchMethodKeys } from '../api';

/** Загружает методики по списку идентификаторов в словарь id → методика. */
export const useResearchMethodsByIds = (methodIds: readonly number[], enabled = true) => {
  const sortedIds = useMemo(
    () => [...new Set(methodIds.filter(id => typeof id === 'number'))].sort((a, b) => a - b),
    [methodIds]
  );

  return useAutoRefetchQuery<Record<number, ResearchMethod>>(
    researchMethodKeys.byIds(sortedIds),
    async () => {
      const entries = await Promise.all(
        sortedIds.map(async id => {
          try {
            const method = await researchApi.getResearchMethod(id);
            return [id, method] as const;
          } catch {
            return null;
          }
        })
      );

      return Object.fromEntries(
        entries.filter((entry): entry is readonly [number, ResearchMethod] => entry !== null)
      );
    },
    { enabled: enabled && sortedIds.length > 0 }
  );
};
