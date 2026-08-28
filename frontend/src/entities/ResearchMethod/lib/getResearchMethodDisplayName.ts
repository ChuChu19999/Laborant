import type { ResearchMethod } from '../api';

export const getResearchMethodDisplayName = (method: ResearchMethod): string => {
  const baseName = method.name || '';
  const lowerName = baseName.toLowerCase();

  const isFractional = lowerName.includes('фракционный состав');
  if (isFractional) {
    return baseName.replace(/\s*\([^)]*\)\s*$/, '').trim();
  }

  if (method.is_group_member && method.groups && method.groups.length > 0) {
    const groupName = method.groups[0]?.name || '';
    if (groupName) {
      if (groupName === 'Вязкость кинематическая') {
        return `${groupName} (${baseName.toLowerCase()})`;
      }
      return groupName;
    }
  }

  return baseName;
};
