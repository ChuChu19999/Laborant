import { APP_VERSION } from '@/shared/config';
import { monitoringApi, type ClientErrorReport, type MonitoringSeverity } from '../api';

const SEEN_KEYS = new Set<string>();
const SKIP_URL_PARTS = ['/api/monitoring/client-errors/', '/api/monitoring/presence/heartbeat/'];

const serializeValue = (value: unknown, seen = new WeakSet<object>()): string => {
  if (value == null) {
    return String(value);
  }
  if (value instanceof Error) {
    return value.stack || value.message;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);
    if (Array.isArray(value)) {
      return `[${value.map(item => serializeValue(item, seen)).join(', ')}]`;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return '[Unserializable]';
    }
  }
  if (typeof value === 'symbol') {
    return value.toString();
  }
  if (typeof value === 'function') {
    return value.name ? `[Function: ${value.name}]` : '[Function]';
  }
  return '[Unknown]';
};

const shouldSkipUrl = (url: string): boolean => {
  return SKIP_URL_PARTS.some(part => url.includes(part));
};

const buildDedupeKey = (severity: MonitoringSeverity, message: string): string => {
  return `${severity}\0${message}`;
};

/** React/antd в DEV часто пишут Warning через console.error — считать предупреждением. */
const isConsoleWarningMessage = (message: string): boolean => {
  const trimmed = message.trimStart();
  return (
    trimmed.startsWith('Warning:') ||
    trimmed.startsWith('warn:') ||
    /^\[.*?\]\s*Warning:/i.test(trimmed)
  );
};

const reportClientError = (payload: ClientErrorReport) => {
  if (shouldSkipUrl(payload.url || '')) {
    return;
  }

  const key = buildDedupeKey(payload.severity, payload.message);
  if (SEEN_KEYS.has(key)) {
    return;
  }
  SEEN_KEYS.add(key);

  void monitoringApi.reportClientError(payload).catch(() => undefined);
};

/** Отправить ошибку клиента в мониторинг. */
export const reportMonitoringClientError = (
  severity: MonitoringSeverity,
  message: string,
  stackTrace?: string | null
) => {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    return;
  }

  reportClientError({
    severity,
    message: trimmedMessage,
    stack_trace: stackTrace?.trim() || null,
    url: window.location.pathname,
    user_agent: navigator.userAgent,
    client_version: APP_VERSION,
  });
};

/** Установить перехват ошибок браузера и console.warn/error. */
export const installClientErrorReporter = () => {
  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    originalWarn(...args);
    const message = args.map(arg => serializeValue(arg)).join(' ');
    reportMonitoringClientError('warning', message);
  };

  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    originalError(...args);
    const message = args.map(arg => serializeValue(arg)).join(' ');
    const severity: MonitoringSeverity = isConsoleWarningMessage(message) ? 'warning' : 'error';
    reportMonitoringClientError(severity, message);
  };

  window.addEventListener('error', event => {
    const parts = [event.message];
    if (event.filename) {
      parts.push(`at ${event.filename}:${event.lineno}:${event.colno}`);
    }
    if (event.error instanceof Error) {
      if (event.error.stack) {
        parts.push(event.error.stack);
      }
      reportMonitoringClientError('error', parts.join('\n'), event.error.stack);
      return;
    }
    reportMonitoringClientError('error', parts.join('\n'), null);
  });

  window.addEventListener('unhandledrejection', event => {
    if (event.reason instanceof Error) {
      reportMonitoringClientError('critical', event.reason.message, event.reason.stack);
      return;
    }
    reportMonitoringClientError('critical', serializeValue(event.reason as unknown));
  });
};
