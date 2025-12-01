import Keycloak from 'keycloak-js';
import { KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID } from './shared/config/process';

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
      onLoad: 'check-sso', // Проверяем, вошел ли пользователь (silent check)
      silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html', // URL для silent SSO
    });

    if (authenticated) {
      keycloakInitialized = true;
      // ВРЕМЕННО: подстановка данных пользователя в токен
      injectMockData();
      const parsedToken = keycloak.tokenParsed;
      console.log('Содержимое токена:', parsedToken);

      // Устанавливаем обработчик события истечения токена
      keycloak.onTokenExpired = async () => {
        console.log('Токен истёк, попытка обновления...');
        try {
          await KeycloakService.updateToken(30);
          // ВРЕМЕННО: подстановка данных после обновления токена
          injectMockData();
          console.log('Токен успешно обновлён!');
        } catch (error) {
          console.error('Не удалось обновить токен, повторная аутентификация:', error);
          keycloak.login();
        }
      };

      // Запускаем автообновление токена
      KeycloakService.startTokenRefresh();

      return parsedToken;
    } else {
      // Если не аутентифицирован, выполняем вход
      keycloak.login();
      throw new Error('Не удалось провести аутентификацию.');
    }
  },

  // Выполнить вход
  login: () => {
    keycloak.login();
  },

  // Выполнить выход
  logout: () => {
    KeycloakService.stopTokenRefresh(); // Останавливаем автообновление токена
    keycloak.logout();
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
  getUsername: () => {
    return keycloak.tokenParsed?.fullName;
  },

  // Запустить автообновление токена
  startTokenRefresh: () => {
    if (tokenRefreshInterval) {
      clearInterval(tokenRefreshInterval);
    }

    // Проверяем токен каждую минуту
    tokenRefreshInterval = setInterval(async () => {
      try {
        const isExpired = await keycloak.isTokenExpired(30); // Проверяем, истечет ли токен в течение 30 секунд
        if (isExpired) {
          console.log('Токен скоро истечет, обновляем...');
          await KeycloakService.updateToken(30);
          // ВРЕМЕННО: подстановка данных после обновления токена
          injectMockData();
          console.log('Токен обновлён автоматически.');
        }
      } catch (error) {
        // Если не получилось обновить или ошибка логиним по новому
        console.error('Ошибка при проверке/обновлении токена:', error);
        keycloak.login();
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
