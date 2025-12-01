import { useEffect } from 'react';
import KeycloakService from '../../../KeycloakService';
import { axiosInstance } from '../../config/axios';

const TOKEN_MIN_VALIDITY = 5; // секунд

export const useAxiosInterceptors = () => {
  useEffect(() => {
    // Интерсептор для добавления токена к каждому запросу
    const requestInterceptor = axiosInstance.interceptors.request.use(
      async config => {
        try {
          const token = KeycloakService.getToken();
          // Если токен есть, пытаемся обновить его если нужно
          if (token) {
            try {
              // Обновляем токен, если он истекает в течение 5 секунд
              await KeycloakService.updateToken(TOKEN_MIN_VALIDITY);
              const updatedToken = KeycloakService.getToken();
              if (updatedToken) {
                config.headers.Authorization = `Bearer ${updatedToken}`;
              }
            } catch (error) {
              // Если не удалось обновить, используем текущий токен
              console.warn('Не удалось обновить токен, используем текущий:', error);
              config.headers.Authorization = `Bearer ${token}`;
            }
          } else {
            console.warn('Токен отсутствует, запрос отправляется без авторизации');
          }
        } catch (error) {
          console.error('Ошибка при обработке токена:', error);
          // Продолжаем без токена
        }
        return config;
      },
      error => {
        return Promise.reject(error);
      }
    );

    // Очистка интерсептора при размонтировании компонента
    return () => {
      axiosInstance.interceptors.request.eject(requestInterceptor);
    };
  }, []);
};
