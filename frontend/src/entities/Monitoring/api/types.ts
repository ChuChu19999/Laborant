import type { PaginatedResponse } from '@/shared/lib/http';

export type MonitoringSeverity = 'warning' | 'error' | 'critical';
export type MonitoringSource = 'backend' | 'frontend';
export type PresenceCategory = 'laborant' | 'engineer' | 'admin';
export type MonitoringPeriod = '24h' | '7d' | '30d' | 'all';

export interface MonitoringOption {
  value: string;
  label: string;
}

export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface MonitoringErrorItem {
  id: number;
  severity: MonitoringSeverity;
  source: MonitoringSource;
  message: string;
  summary: string;
  stack_trace: string | null;
  path: string | null;
  exception_type: string | null;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  reporter_name: string | null;
  browser: string | null;
  app_version: string | null;
  resolved_by_name: string | null;
  resolve_comment: string | null;
}

export interface OnlineUserItem {
  full_name: string;
  presence_category: PresenceCategory;
  last_seen_at: string;
  current_path: string | null;
}

export interface PresenceStats {
  total: number;
  laborant: number;
  engineer: number;
  admin: number;
  online_users: OnlineUserItem[];
}

export interface MonitoringOverview {
  health_status: HealthStatus;
  db_latency_ms: number | null;
  app_version: string;
  period: MonitoringPeriod;
  default_period: MonitoringPeriod;
  period_options: MonitoringOption[];
  severity_options: MonitoringOption[];
  source_options: MonitoringOption[];
  resolved_options: MonitoringOption[];
  health_options: MonitoringOption[];
  presence_options: MonitoringOption[];
  new_errors_count: number;
  presence: PresenceStats;
}

export interface MonitoringErrorFilters {
  severity?: MonitoringSeverity;
  source?: MonitoringSource;
  resolved?: boolean;
  search?: string;
  occurrence_count?: number;
  app_version?: string;
  last_seen_at_from?: string;
  last_seen_at_to?: string;
  period: MonitoringPeriod;
  [key: string]: unknown;
}

export interface ClientErrorReport {
  severity: MonitoringSeverity;
  message: string;
  stack_trace?: string | null;
  url?: string | null;
  user_agent?: string | null;
  client_version?: string | null;
}

export interface HeartbeatPayload {
  current_path?: string | null;
  from_app?: boolean;
}

export interface MonitoringErrorsListParams {
  page?: number;
  page_size?: number;
  filters?: MonitoringErrorFilters;
  sorting?: { sort_by?: string; sort_order?: 'asc' | 'desc' };
}

export type MonitoringErrorsListResponse = PaginatedResponse<MonitoringErrorItem>;

export interface MonitoringCleanupResult {
  message: string;
  deleted_count: number;
}
