import React, { useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import {
  filtersToUrlParams,
  urlParamsToFilters,
  getPaginationFromUrl,
  getSortingFromUrl,
  updateUrlParams,
} from '../../lib/urlParams';

export interface UseUrlSyncOptions {
  filterKeys: string[];
  defaultPage?: number;
  defaultPageSize?: number;
}

/**
 * Хук для синхронизации store с URL параметрами
 * Полезен для сохранения состояния фильтров, пагинации и сортировки в URL
 */
export function useUrlSync<TFilters extends Record<string, unknown> = Record<string, unknown>>(
  options: UseUrlSyncOptions,
  storeState: {
    page: number;
    pageSize: number;
    filters?: TFilters;
    sorting?: { sort_by?: string; sort_order?: 'asc' | 'desc' };
  },
  storeActions: {
    setPage: (page: number) => void;
    setPageSize: (pageSize: number) => void;
    setFilters: (filters: TFilters | undefined) => void;
    setSorting: (sorting: { sort_by?: string; sort_order?: 'asc' | 'desc' } | undefined) => void;
  }
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { filterKeys, defaultPage = 1, defaultPageSize = 20 } = options;
  const previousPathRef = useRef<string | undefined>(undefined);
  const isInitialMountRef = useRef(true);
  const isResettingRef = useRef(false);

  // Сброс параметров при изменении роута
  useEffect(() => {
    // Пропускаем первый рендер
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      previousPathRef.current = location.pathname;
      return;
    }

    // Если путь изменился, сбрасываем параметры URL и store
    if (previousPathRef.current !== undefined && previousPathRef.current !== location.pathname) {
      // Устанавливаем флаг сброса, чтобы предотвратить восстановление параметров
      isResettingRef.current = true;

      // Сначала сбрасываем параметры URL (если они есть)
      if (searchParams.toString()) {
        const newParams = new URLSearchParams();
        setSearchParams(newParams, { replace: true });
      }

      // Затем сбрасываем store
      storeActions.setPage(defaultPage);
      storeActions.setPageSize(defaultPageSize);
      storeActions.setFilters(undefined);
      storeActions.setSorting(undefined);

      // Сбрасываем флаг после задержки, чтобы дать время всем эффектам завершиться
      setTimeout(() => {
        isResettingRef.current = false;
      }, 100);
    }

    previousPathRef.current = location.pathname;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, defaultPage, defaultPageSize, setSearchParams, storeActions]);

  // Инициализация из URL при первой загрузке
  useEffect(() => {
    // Пропускаем инициализацию, если происходит сброс
    if (isResettingRef.current) {
      return;
    }

    const urlPage = getPaginationFromUrl(searchParams).page;
    const urlPageSize = getPaginationFromUrl(searchParams).pageSize;
    const urlFilters = urlParamsToFilters(searchParams, filterKeys) as TFilters;
    const urlSorting = getSortingFromUrl(searchParams);

    // Обновляем store только если в URL есть параметры и они отличаются от текущего состояния
    if (searchParams.toString()) {
      if (urlPage !== storeState.page) {
        storeActions.setPage(urlPage);
      }
      if (urlPageSize !== storeState.pageSize) {
        storeActions.setPageSize(urlPageSize);
      }
      const hasUrlFilters = Object.keys(urlFilters).length > 0;
      const hasStoreFilters = storeState.filters && Object.keys(storeState.filters).length > 0;
      if (hasUrlFilters && JSON.stringify(urlFilters) !== JSON.stringify(storeState.filters)) {
        storeActions.setFilters(urlFilters);
      } else if (!hasUrlFilters && hasStoreFilters) {
        // Если в URL нет фильтров, но в store есть - очищаем store (но не обновляем URL, чтобы избежать цикла)
        // Это происходит только при первой загрузке, если URL пустой
      }
      if (urlSorting.sort_by) {
        if (
          urlSorting.sort_by !== storeState.sorting?.sort_by ||
          urlSorting.sort_order !== storeState.sorting?.sort_order
        ) {
          storeActions.setSorting(urlSorting);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Только при монтировании

  // Синхронизация store -> URL (только при изменении store, не при монтировании)
  const isInitialMount = React.useRef(true);

  useEffect(() => {
    // Пропускаем первую синхронизацию, чтобы не перезаписать URL при инициализации из URL
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Пропускаем синхронизацию, если происходит сброс при изменении пути
    if (isResettingRef.current) {
      return;
    }

    const urlUpdates: Record<string, string | number | undefined> = {
      page: storeState.page !== defaultPage ? storeState.page : undefined,
      pageSize: storeState.pageSize !== defaultPageSize ? storeState.pageSize : undefined,
      sortBy: storeState.sorting?.sort_by,
      sortOrder: storeState.sorting?.sort_order,
    };

    // Добавляем фильтры
    if (storeState.filters) {
      const filterParams = filtersToUrlParams(storeState.filters);
      Object.assign(urlUpdates, filterParams);
    }

    // Удаляем параметры, которых нет в store
    filterKeys.forEach(key => {
      if (!storeState.filters || !storeState.filters[key]) {
        urlUpdates[key] = undefined;
      }
    });

    const newParams = updateUrlParams(searchParams, urlUpdates);

    // Обновляем URL только если есть изменения
    if (newParams.toString() !== searchParams.toString()) {
      setSearchParams(newParams, { replace: true });
    }
  }, [storeState, searchParams, setSearchParams, filterKeys, defaultPage, defaultPageSize]);

  // Обертки для действий, которые обновляют URL через store
  const setPage = useCallback(
    (page: number) => {
      storeActions.setPage(page);
    },
    [storeActions]
  );

  const setPageSize = useCallback(
    (pageSize: number) => {
      storeActions.setPageSize(pageSize);
    },
    [storeActions]
  );

  const setFilters = useCallback(
    (filters: TFilters | undefined) => {
      storeActions.setFilters(filters);
    },
    [storeActions]
  );

  const setSorting = useCallback(
    (sorting: { sort_by?: string; sort_order?: 'asc' | 'desc' } | undefined) => {
      storeActions.setSorting(sorting);
    },
    [storeActions]
  );

  return {
    setPage,
    setPageSize,
    setFilters,
    setSorting,
  };
}
