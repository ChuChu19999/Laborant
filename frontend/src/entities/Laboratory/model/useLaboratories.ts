import { useAutoRefetchQuery } from '@/shared/model';
import { laboratoriesApi, type Laboratory, laboratoryKeys } from '../api';

/** Загружает список лабораторий. */
export const useLaboratories = (enabled = true) => {
  return useAutoRefetchQuery<{ items: Laboratory[] }>(
    laboratoryKeys.list(),
    () => laboratoriesApi.getLaboratories(),
    { enabled }
  );
};

/** Загружает лабораторию по ID. */
export const useLaboratory = (id: number | undefined, enabled = true) => {
  const isQueryEnabled = enabled && id != null;
  return useAutoRefetchQuery<Laboratory>(
    laboratoryKeys.detail(id),
    () => {
      if (id == null) {
        return Promise.reject(new Error('Laboratory id is required'));
      }
      return laboratoriesApi.getLaboratory(id);
    },
    { enabled: isQueryEnabled }
  );
};
