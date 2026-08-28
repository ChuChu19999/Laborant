export const fixtureKeys = {
  all: ['fixtures'] as const,
  details: () => [...fixtureKeys.all, 'detail'] as const,
  detail: (path: string) => [...fixtureKeys.details(), path] as const,
  directories: (laboratoryName: string) =>
    [...fixtureKeys.all, 'directories', laboratoryName] as const,
  files: (dirPath: string) => [...fixtureKeys.all, 'files', dirPath] as const,
  savedTree: () => [...fixtureKeys.all, 'saved-tree'] as const,
};
