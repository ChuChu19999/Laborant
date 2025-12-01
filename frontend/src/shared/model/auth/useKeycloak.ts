import { useEffect, useState } from 'react';
import KeycloakService from '../../../KeycloakService';

interface UseKeycloakReturn {
  isLoading: boolean;
  isAuthenticated: boolean;
  username: string;
  error: Error | null;
}

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
        setUsername(tokenData?.fullName || '');
      } catch (err) {
        setIsAuthenticated(false);
        setUsername('');
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        console.error('Не удалось инициализировать Keycloak:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeKeycloak();
  }, []);

  return {
    isLoading,
    isAuthenticated,
    username,
    error,
  };
};
