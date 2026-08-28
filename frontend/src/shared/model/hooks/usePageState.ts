import { useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export interface UsePageStateOptions {
  /** Ключ для сохранения в sessionStorage. */
  storageKey: string;
  /** Условие сохранения URL; если не задано, сохраняется при любом изменении location. */
  shouldSave?: (pathname: string, search: string) => boolean;
  /** Условие удаления сохранённого состояния. */
  shouldRemove?: (pathname: string, search: string) => boolean;
}

/** Сохраняет и восстанавливает URL страницы в sessionStorage. */
export function usePageState(options: UsePageStateOptions) {
  const { storageKey, shouldSave, shouldRemove } = options;
  const location = useLocation();
  const navigate = useNavigate();

  // Сохранение URL при изменении location
  useEffect(() => {
    const shouldSaveState = shouldSave ? shouldSave(location.pathname, location.search) : true;

    if (shouldSaveState) {
      sessionStorage.setItem(storageKey, location.pathname + location.search);
    }

    if (shouldRemove && shouldRemove(location.pathname, location.search)) {
      sessionStorage.removeItem(storageKey);
    }
  }, [location.pathname, location.search, storageKey, shouldSave, shouldRemove]);

  /** Восстанавливает сохранённый URL страницы. */
  const restoreState = useCallback(
    (defaultPath?: string, defaultSearch: string = '') => {
      const savedState = sessionStorage.getItem(storageKey);
      if (savedState) {
        const [savedPath, savedSearch] = savedState.split('?');
        const search = savedSearch ? `?${savedSearch}` : '';
        void navigate({ pathname: savedPath, search }, { replace: true });
        return true;
      }
      if (defaultPath) {
        void navigate({ pathname: defaultPath, search: defaultSearch }, { replace: true });
        return true;
      }
      return false;
    },
    [storageKey, navigate]
  );

  /** Возвращает сохранённое состояние без навигации. */
  const getSavedState = useCallback(() => {
    const savedState = sessionStorage.getItem(storageKey);
    if (savedState) {
      const [savedPath, savedSearch] = savedState.split('?');
      return {
        pathname: savedPath,
        search: savedSearch ? `?${savedSearch}` : '',
      };
    }
    return null;
  }, [storageKey]);

  /** Очищает сохранённое состояние. */
  const clearState = useCallback(() => {
    sessionStorage.removeItem(storageKey);
  }, [storageKey]);

  return {
    restoreState,
    getSavedState,
    clearState,
  };
}
