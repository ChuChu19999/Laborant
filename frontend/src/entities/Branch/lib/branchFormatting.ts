/** Отображение филиала в селектах: «Название (телефон)». */
export function formatBranchDisplay(branch: {
  name?: string | null;
  phone?: string | null;
}): string {
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
