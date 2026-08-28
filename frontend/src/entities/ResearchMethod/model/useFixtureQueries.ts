import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAutoRefetchQuery } from '@/shared/model';
import { fixturesApi, fixtureKeys } from '../api';
import type { FixtureDirectoryEntry, SavedMethodsTreeResponse } from '../api';

type FixtureDirectoriesResponse = {
  directories: FixtureDirectoryEntry[];
};

/** Загружает дерево сохранённых методов лабораторий. */
export const useSavedMethodsTree = (enabled = true) => {
  return useAutoRefetchQuery<SavedMethodsTreeResponse>(
    fixtureKeys.savedTree(),
    () => fixturesApi.getSavedMethodsTree(),
    {
      enabled,
      refetchInterval: false,
      refetchOnWindowFocus: false,
    }
  );
};

/** Загружает каталог директорий типовых фикстур для лаборатории. */
export const useFixtureDirectories = (laboratoryName: string | undefined, enabled = true) => {
  const canLoad = laboratoryName != null && laboratoryName.trim() !== '';
  return useAutoRefetchQuery<FixtureDirectoriesResponse>(
    fixtureKeys.directories(laboratoryName ?? ''),
    () => {
      if (laboratoryName == null || laboratoryName.trim() === '') {
        return Promise.reject(new Error('Laboratory name is required'));
      }
      return fixturesApi.getFixtureDirectories(laboratoryName);
    },
    {
      enabled: enabled && canLoad,
      refetchInterval: false,
      refetchOnWindowFocus: false,
    }
  );
};

/** Императивные загрузки фикстур через React Query cache. */
export const useFixtureQueries = () => {
  const queryClient = useQueryClient();

  const fetchFixture = useCallback(
    (path: string) =>
      queryClient.fetchQuery({
        queryKey: fixtureKeys.detail(path),
        queryFn: () => fixturesApi.getFixture(path),
      }),
    [queryClient]
  );

  const fetchFixtureDirectories = useCallback(
    (name: string) =>
      queryClient.fetchQuery({
        queryKey: fixtureKeys.directories(name),
        queryFn: () => fixturesApi.getFixtureDirectories(name),
      }),
    [queryClient]
  );

  const fetchFixtureFiles = useCallback(
    (dirPath: string) =>
      queryClient.fetchQuery({
        queryKey: fixtureKeys.files(dirPath),
        queryFn: () => fixturesApi.listFixtureFiles(dirPath),
      }),
    [queryClient]
  );

  const fetchSavedMethodsTree = useCallback(
    () =>
      queryClient.fetchQuery({
        queryKey: fixtureKeys.savedTree(),
        queryFn: () => fixturesApi.getSavedMethodsTree(),
      }),
    [queryClient]
  );

  return {
    fetchFixture,
    fetchFixtureDirectories,
    fetchFixtureFiles,
    fetchSavedMethodsTree,
  };
};
