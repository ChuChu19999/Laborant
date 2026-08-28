import type { StateCreator, StoreMutatorIdentifier } from 'zustand';

type Logger = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  config: StateCreator<T, Mps, Mcs>,
  name?: string
) => StateCreator<T, Mps, Mcs>;

type LoggerImpl = <T>(config: StateCreator<T, [], []>, name?: string) => StateCreator<T, [], []>;

/** Middleware для логирования изменений стейта в режиме разработки. */
const loggerImpl: LoggerImpl = config => (set, get, api) =>
  config(
    (partial, replace) => {
      if (import.meta.env.DEV) {
        console.log('Zustand State Update:', { partial, replace });
      }
      (set as (value: unknown, shouldReplace?: boolean) => void)(partial, replace);
    },
    get,
    api
  );

export const logger = loggerImpl as unknown as Logger;
