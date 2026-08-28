import { useEffect } from 'react';
import { axiosInstance } from '@/shared/config';
import { KeycloakService } from '@/shared/lib/keycloak';
import { notify } from '@/shared/lib/notify';

const TOKEN_MIN_VALIDITY = 5; // секунд

export const useAxiosInterceptors = () => {
  useEffect(() => {
    const requestInterceptor = axiosInstance.interceptors.request.use(
      async config => {
        try {
          const token = KeycloakService.getToken();
          if (token) {
            try {
              await KeycloakService.updateToken(TOKEN_MIN_VALIDITY);
              const updatedToken = KeycloakService.getToken();
              if (updatedToken) {
                config.headers.Authorization = `Bearer ${updatedToken}`;
              }
            } catch {
              // Обновление токена не удалось — продолжаем с текущим без уведомления
              config.headers.Authorization = `Bearer ${token}`;
            }
          }
        } catch {
          notify.error('Не удалось подготовить авторизацию для запроса.');
        }
        return config;
      },
      (error: unknown) => {
        return Promise.reject(
          error instanceof Error ? error : new Error('Request interceptor error')
        );
      }
    );

    return () => {
      axiosInstance.interceptors.request.eject(requestInterceptor);
    };
  }, []);
};
