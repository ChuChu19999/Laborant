import Keycloak from 'keycloak-js';
import { KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID } from '../../config';

if (!KEYCLOAK_URL || !KEYCLOAK_REALM || !KEYCLOAK_CLIENT_ID) {
  throw new Error(
    'Keycloak configuration is missing. Please set VITE_KEYCLOAK_URL, VITE_KEYCLOAK_REALM, and VITE_KEYCLOAK_CLIENT_ID in your .env file.'
  );
}

const keycloak = new Keycloak({
  realm: KEYCLOAK_REALM,
  url: KEYCLOAK_URL,
  clientId: KEYCLOAK_CLIENT_ID,
});

// Переменная для отслеживания инициализации Keycloak
let keycloakInitialized = false;
// Переменная для хранения таймера автообновления токена
let tokenRefreshInterval: ReturnType<typeof setInterval> | null = null;

// ВРЕМЕННО: функция для подстановки данных пользователя в токен
const injectMockData = () => {
  if (keycloak.tokenParsed) {
    keycloak.tokenParsed.hashSnils = 'e1cee128188b77f382eec32ca80494e6';
  }
};

const KeycloakService = {
  //  Инициализация Keycloak
  init: async () => {
    if (keycloakInitialized) {
      return keycloak.tokenParsed;
    }

    const authenticated = await keycloak.init({
      onLoad: 'check-sso', // Проверяем, вошёл ли пользователь (silent check)
      silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html', // URL для silent SSO
    });

    if (authenticated) {
      keycloakInitialized = true;
      // ВРЕМЕННО: подстановка данных пользователя в токен
      injectMockData();
      const parsedToken = keycloak.tokenParsed;

      // Устанавливаем обработчик события истечения токена
      keycloak.onTokenExpired = () => {
        void KeycloakService.updateToken(30)
          .then(() => {
            // ВРЕМЕННО: подстановка данных после обновления токена
            injectMockData();
          })
          .catch(error => {
            console.error('Не удалось обновить токен, повторная аутентификация:', error);
            void keycloak.login();
          });
      };

      // Запускаем автообновление токена
      KeycloakService.startTokenRefresh();

      return parsedToken;
    } else {
      // Если не аутентифицирован, выполняем вход
      void keycloak.login();
      throw new Error('Не удалось провести аутентификацию.');
    }
  },

  // Выполнить вход
  login: () => {
    void keycloak.login();
  },

  // Выполнить выход
  logout: () => {
    KeycloakService.stopTokenRefresh(); // Останавливаем автообновление токена
    void keycloak.logout();
  },

  // Получить текущий токен
  getToken: () => {
    return keycloak.token;
  },

  //  Получить refresh-токен
  getRefreshToken: () => {
    return keycloak.refreshToken;
  },

  //  Обновить токен, minValidity Минимальная валидность токена (в секундах)
  updateToken: async (minValidity: number) => {
    if (!keycloak.token) {
      throw new Error('Unable to update token, no token available');
    }
    const result = await keycloak.updateToken(minValidity);
    // ВРЕМЕННО: подстановка данных после обновления токена
    injectMockData();
    return result;
  },

  // Проверка токена истечёт ли в течении указанного времени в секундах
  isTokenExpired: (expiredTime: number) => {
    return keycloak.isTokenExpired(expiredTime);
  },

  // Получить ФИО пользователя
  getUsername: (): string | undefined => {
    const parsed = keycloak.tokenParsed as { fullName?: unknown } | undefined;
    return typeof parsed?.fullName === 'string' ? parsed.fullName : undefined;
  },

  // Запустить автообновление токена
  startTokenRefresh: () => {
    if (tokenRefreshInterval) {
      clearInterval(tokenRefreshInterval);
    }

    // Проверяем токен каждую минуту
    tokenRefreshInterval = setInterval(() => {
      try {
        const isExpired = keycloak.isTokenExpired(30); // Проверяем, истечет ли токен в течение 30 секунд
        if (isExpired) {
          void KeycloakService.updateToken(30)
            .then(() => {
              // ВРЕМЕННО: подстановка данных после обновления токена
              injectMockData();
            })
            .catch(error => {
              console.error('Ошибка при проверке/обновлении токена:', error);
              void keycloak.login();
            });
        }
      } catch (error) {
        // Если не получилось обновить или ошибка логиним по новому
        console.error('Ошибка при проверке/обновлении токена:', error);
        void keycloak.login();
      }
    }, 60000);
  },

  // Остановить автообновление токена
  stopTokenRefresh: () => {
    if (tokenRefreshInterval) {
      clearTimeout(tokenRefreshInterval);
      tokenRefreshInterval = null;
    }
  },
};

export default KeycloakService;
