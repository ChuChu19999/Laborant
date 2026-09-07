import { axiosInstance } from '@/shared/config';
import type {
  ClientErrorReport,
  HeartbeatPayload,
  MonitoringCleanupResult,
  MonitoringErrorsListParams,
  MonitoringErrorsListResponse,
  MonitoringOverview,
  MonitoringPeriod,
} from './types';

/** API мониторинга. */
export const monitoringApi = {
  getOverview: async (period: MonitoringPeriod = '24h'): Promise<MonitoringOverview> => {
    const response = await axiosInstance.get<MonitoringOverview>('/api/monitoring/overview/', {
      params: { period },
    });
    return response.data;
  },

  getErrors: async (params: MonitoringErrorsListParams): Promise<MonitoringErrorsListResponse> => {
    const query: Record<string, unknown> = {};

    if (params.page !== undefined) {
      query.page = params.page;
    }
    if (params.page_size !== undefined) {
      query.page_size = params.page_size;
    }
    if (params.filters?.severity) {
      query.severity = params.filters.severity;
    }
    if (params.filters?.source) {
      query.source = params.filters.source;
    }
    if (params.filters?.resolved !== undefined) {
      query.resolved = params.filters.resolved;
    }
    if (params.filters?.search) {
      query.search = params.filters.search;
    }
    if (params.filters?.occurrence_count !== undefined) {
      query.occurrence_count = params.filters.occurrence_count;
    }
    if (params.filters?.app_version) {
      query.app_version = params.filters.app_version;
    }
    if (params.filters?.last_seen_at_from) {
      query.last_seen_at_from = params.filters.last_seen_at_from;
    }
    if (params.filters?.last_seen_at_to) {
      query.last_seen_at_to = params.filters.last_seen_at_to;
    }
    query.period = params.filters?.period ?? '24h';
    if (params.sorting?.sort_by) {
      query.sort_by = params.sorting.sort_by;
    }
    if (params.sorting?.sort_order) {
      query.sort_order = params.sorting.sort_order;
    }

    const response = await axiosInstance.get<MonitoringErrorsListResponse>(
      '/api/monitoring/errors/',
      {
        params: query,
      }
    );
    return response.data;
  },

  reportClientError: async (payload: ClientErrorReport): Promise<void> => {
    await axiosInstance.post('/api/monitoring/client-errors/', payload);
  },

  sendHeartbeat: async (payload?: HeartbeatPayload): Promise<void> => {
    await axiosInstance.post('/api/monitoring/presence/heartbeat/', {
      ...payload,
      from_app: true,
    });
  },

  updateErrorStatus: async (
    errorId: number,
    resolved: boolean,
    comment?: string | null
  ): Promise<void> => {
    await axiosInstance.patch(`/api/monitoring/errors/${errorId}/status/`, {
      resolved,
      comment: comment ?? null,
    });
  },

  cleanupClosedErrors: async (): Promise<MonitoringCleanupResult> => {
    const response = await axiosInstance.post<MonitoringCleanupResult>(
      '/api/monitoring/errors/cleanup-closed/'
    );
    return response.data;
  },
};
