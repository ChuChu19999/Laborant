import type { StateCreator } from 'zustand';

/**
 * Middleware для логирования изменений стейта (для разработки)
 */
export const logger =
  <T>(config: StateCreator<T>): StateCreator<T> =>
  (set, get, api) =>
    config(
      ((partial, replace) => {
        if (import.meta.env.DEV) {
          console.log('Zustand State Update:', { partial, replace });
        }
        if (replace === true) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          set(partial as any, true);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          set(partial as any);
        }
      }) as typeof set,
      get,
      api
    );
