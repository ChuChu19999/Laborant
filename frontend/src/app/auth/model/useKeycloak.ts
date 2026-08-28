import { useEffect, useState } from 'react';
import { KeycloakService } from '@/shared/lib/keycloak';
import { notify } from '@/shared/lib/notify';

interface UseKeycloakReturn {
  isLoading: boolean;
  isAuthenticated: boolean;
  username: string;
  error: Error | null;
}

/** Инициализирует Keycloak и возвращает статус аутентификации и ФИО. */
export const useKeycloak = (): UseKeycloakReturn => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initializeKeycloak = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const tokenData = await KeycloakService.init();
        setIsAuthenticated(true);
        const fullName =
          tokenData && typeof (tokenData as { fullName?: unknown }).fullName === 'string'
            ? (tokenData as { fullName: string }).fullName
            : '';
        setUsername(fullName);
      } catch (err) {
        setIsAuthenticated(false);
        setUsername('');
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        notify.error(
          'Не удалось инициализировать авторизацию. Обновите страницу или войдите снова.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    void initializeKeycloak();
  }, []);

  return {
    isLoading,
    isAuthenticated,
    username,
    error,
  };
};
