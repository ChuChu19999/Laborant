import type { MonitoringOption } from '../api';

/** Вернуть подпись варианта по value из списка options API. */
export function getMonitoringOptionLabel(options: MonitoringOption[], value: string): string {
  return options.find(option => option.value === value)?.label ?? value;
}
