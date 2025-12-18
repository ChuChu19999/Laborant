import { useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export interface UsePageStateOptions {
  /**
   * Ключ для сохранения в sessionStorage
   */
  storageKey: string;
  /**
   * Условие для сохранения URL (например, pathname.startsWith('/samples'))
   * Если не указано, сохраняется всегда при изменении location
   */
  shouldSave?: (pathname: string, search: string) => boolean;
  /**
   * Условие для удаления сохраненного состояния
   * Если не указано, состояние не удаляется автоматически
   */
  shouldRemove?: (pathname: string, search: string) => boolean;
}

/**
 * Хук для сохранения и восстановления состояния страницы в sessionStorage
 * Полезен для сохранения URL при переключении между страницами
 */
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

  /**
   * Восстанавливает сохраненное состояние страницы
   * @param defaultPath - Путь по умолчанию, если сохраненного состояния нет
   * @param defaultSearch - Поисковые параметры по умолчанию
   */
  const restoreState = useCallback(
    (defaultPath?: string, defaultSearch: string = '') => {
      const savedState = sessionStorage.getItem(storageKey);
      if (savedState) {
        const [savedPath, savedSearch] = savedState.split('?');
        const search = savedSearch ? `?${savedSearch}` : '';
        navigate({ pathname: savedPath, search }, { replace: true });
        return true;
      }
      if (defaultPath) {
        navigate({ pathname: defaultPath, search: defaultSearch }, { replace: true });
        return true;
      }
      return false;
    },
    [storageKey, navigate]
  );

  /**
   * Получает сохраненное состояние без навигации
   */
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

  /**
   * Очищает сохраненное состояние
   */
  const clearState = useCallback(() => {
    sessionStorage.removeItem(storageKey);
  }, [storageKey]);

  return {
    restoreState,
    getSavedState,
    clearState,
  };
}
