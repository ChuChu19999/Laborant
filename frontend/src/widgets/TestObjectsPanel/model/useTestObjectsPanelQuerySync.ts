import { useSearchParams } from 'react-router-dom';
import { useTestObjectsQueryStore, type TestObjectFilters } from '@/entities/TestObject';
import { useUrlSync } from '@/shared/model';
import { TEST_OBJECT_FILTER_KEYS } from '../lib/buildTestObjectsColumnFilters';

/** Синхронизирует параметры списка объектов испытаний между URL и Zustand-store. */
export const useTestObjectsPanelQuerySync = () => {
  const [searchParams] = useSearchParams();
  const {
    testObjectsQuery,
    setTestObjectsPage,
    setTestObjectsPageSize,
    setTestObjectsFilters,
    setTestObjectsSorting,
  } = useTestObjectsQueryStore();

  useUrlSync<TestObjectFilters>(
    {
      filterKeys: TEST_OBJECT_FILTER_KEYS,
      defaultPage: 1,
      defaultPageSize: 20,
    },
    {
      ...testObjectsQuery,
      filters: testObjectsQuery.filters,
    },
    {
      setPage: setTestObjectsPage,
      setPageSize: setTestObjectsPageSize,
      setFilters: setTestObjectsFilters,
      setSorting: setTestObjectsSorting,
    }
  );

  return { searchParams };
};
