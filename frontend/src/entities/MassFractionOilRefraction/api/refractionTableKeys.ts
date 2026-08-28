export const refractionTableKeys = {
  all: ['refraction-tables'] as const,
  lists: () => [...refractionTableKeys.all, 'list'] as const,
  list: (researchMethodId: number | undefined) =>
    [...refractionTableKeys.lists(), researchMethodId] as const,
  byMethod: (researchMethodId: number | undefined) => refractionTableKeys.list(researchMethodId),
};
