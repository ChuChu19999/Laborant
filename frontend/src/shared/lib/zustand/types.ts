export interface QueryParams {
  page: number;
  pageSize: number;
}

export interface QueryFilters {
  [key: string]: unknown;
}

export interface QuerySorting {
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface QueryState<TFilters = QueryFilters> extends QueryParams {
  filters?: TFilters;
  sorting?: QuerySorting;
}
