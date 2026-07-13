import type { Branch } from '../api/samplingLocations';

/** Отображение филиала в списках выбора: «Название (телефон)». */
export function formatBranchDisplay(branch: Pick<Branch, 'name' | 'phone'>): string {
  const name = branch.name?.trim() || '';
  const phone = branch.phone?.trim();
  if (!name) {
    return phone || '';
  }
  if (!phone) {
    return name;
  }
  return `${name} (${phone})`;
}
