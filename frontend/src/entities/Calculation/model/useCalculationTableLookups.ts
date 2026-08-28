import { useMemo } from 'react';
import {
  getResearchMethodDisplayName,
  useResearchMethodsByIds,
} from '@/entities/ResearchMethod/@x/Calculation';

/** Справочники названий и порядка сортировки методик для таблицы расчётов. */
export const useCalculationMethodsLookup = (methodIds: readonly number[], enabled = true) => {
  const { data: methodsById = {}, isLoading } = useResearchMethodsByIds(methodIds, enabled);

  const methodDisplayNames = useMemo(() => {
    const names: Record<number, string> = {};
    Object.entries(methodsById).forEach(([id, method]) => {
      names[Number(id)] = getResearchMethodDisplayName(method);
    });
    return names;
  }, [methodsById]);

  const methodSortOrders = useMemo(() => {
    const orders: Record<number, number | null> = {};
    Object.entries(methodsById).forEach(([id, method]) => {
      orders[Number(id)] = method.sort_order ?? null;
    });
    return orders;
  }, [methodsById]);

  return {
    methodsById,
    methodDisplayNames,
    methodSortOrders,
    isLoading,
  };
};
