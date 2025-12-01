/**
 * Утилиты для работы с URL параметрами
 */

export interface UrlQueryParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: string | number | string[] | undefined;
}

/**
 * Преобразование объекта фильтров в URL параметры
 */
export function filtersToUrlParams(filters: Record<string, unknown>): Record<string, string> {
  const params: Record<string, string> = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        params[key] = value.join(',');
      }
    } else {
      params[key] = String(value);
    }
  });

  return params;
}

/**
 * Преобразование URL параметров в объект фильтров
 */
export function urlParamsToFilters(
  searchParams: URLSearchParams,
  filterKeys: string[]
): Record<string, string | string[]> {
  const filters: Record<string, string | string[]> = {};

  filterKeys.forEach(key => {
    const value = searchParams.get(key);
    if (value !== null && value !== '') {
      if (value.includes(',')) {
        filters[key] = value.split(',').filter(v => v.trim() !== '');
      } else {
        filters[key] = value;
      }
    }
  });

  return filters;
}

/**
 * Получение параметров пагинации из URL
 */
export function getPaginationFromUrl(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
} {
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

  return {
    page: isNaN(page) || page < 1 ? 1 : page,
    pageSize: isNaN(pageSize) || pageSize < 1 ? 20 : pageSize,
  };
}

/**
 * Получение параметров сортировки из URL
 */
export function getSortingFromUrl(searchParams: URLSearchParams): {
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
} {
  const sortBy = searchParams.get('sortBy');
  const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' | null;

  if (!sortBy) {
    return {};
  }

  return {
    sort_by: sortBy,
    sort_order: sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : undefined,
  };
}

/**
 * Обновление URL параметров без перезагрузки страницы
 */
export function updateUrlParams(
  searchParams: URLSearchParams,
  updates: Record<string, string | number | string[] | undefined | null>
): URLSearchParams {
  const newParams = new URLSearchParams(searchParams);

  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      newParams.delete(key);
    } else if (Array.isArray(value)) {
      if (value.length > 0) {
        newParams.set(key, value.join(','));
      } else {
        newParams.delete(key);
      }
    } else {
      newParams.set(key, String(value));
    }
  });

  return newParams;
}
