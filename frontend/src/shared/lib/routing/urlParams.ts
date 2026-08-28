import { toDisplayString } from '../formatting';

export interface UrlQueryParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: string | number | string[] | undefined;
}

/** Преобразует объект фильтров в URL-параметры. */
export function filtersToUrlParams(filters: Record<string, unknown>): Record<string, string> {
  const params: Record<string, string> = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        params[key] = value
          .map(item => toDisplayString(item))
          .filter(Boolean)
          .join(',');
      }
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      params[key] = toDisplayString(value);
    }
  });

  return params;
}

/** Преобразует URL-параметры в объект фильтров. */
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

/** Приводит значение фильтра из URL к массиву строк для мультивыбора. */
export function urlFilterValueToStringArray(
  plural: string | string[] | undefined,
  singular: string | string[] | undefined
): string[] {
  const raw = plural ?? singular;
  if (!raw) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw;
  }
  return [raw];
}

/** Нормализует фильтры из URL перед записью в store. */
export function normalizeUrlFilters<T extends Record<string, unknown>>(
  filters: T,
  arrayFilterKeys: string[] = []
): T {
  const normalized = { ...filters } as Record<string, unknown>;

  arrayFilterKeys.forEach(key => {
    const value = normalized[key];
    if (typeof value === 'string') {
      normalized[key] = [value];
    }
  });

  return normalized as T;
}

/** Распарсить целочисленный query/path-параметр; пустая строка и NaN → undefined. */
export function parseSearchParamInt(value: string | null): number | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Читает параметры пагинации из URL. */
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

/** Читает параметры сортировки из URL. */
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

/** Обновляет URL-параметры без перезагрузки страницы. */
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
      newParams.set(key, toDisplayString(value));
    }
  });

  return newParams;
}
