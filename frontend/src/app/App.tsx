import { useEffect, useMemo, useRef } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider, message } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import '../shared/assets/fonts/fonts.css';
import './App.css';
import AdminPage from '../pages/AdminPage/AdminPage';
import EquipmentPage from '../pages/EquipmentPage/EquipmentPage';
import Page404 from '../pages/ErrorPages/Page404/Page404';
import LoadingPage from '../pages/LoadingPage/LoadingPage';
import ProtocolsPage from '../pages/ProtocolsPage/ProtocolsPage';
import SamplesPage from '../pages/SamplesPage/SamplesPage';
import { useAxiosInterceptors } from '../shared/model/auth/useAxiosInterceptors';
import { useKeycloak } from '../shared/model/auth/useKeycloak';
import ProtectedRoute from '../shared/ui/ProtectedRoute/ProtectedRoute';
import Content from './Content/Content';
import { routersData } from './data';

// Экземпляр QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // Данные считаются свежими 30 секунд
      gcTime: 5 * 60 * 1000, // Кэш хранится 5 минут
      refetchOnWindowFocus: true, // Включено автообновление при фокусе
      refetchOnReconnect: true, // Обновление при восстановлении соединения
      retry: 2, // Количество повторных попыток при ошибке
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000), // Экспоненциальная задержка до 10 секунд
    },
  },
});

interface RouteItem {
  path: string;
  element: React.ReactElement;
  children?: RouteItem[];
}

export default function App() {
  const { isLoading, username } = useKeycloak();

  useAxiosInterceptors();

  const messageConfigRef = useRef(false);
  const isAdmin = true; // По умолчанию админ (без проверки роли)

  // Компонент для промежуточной перезагрузки
  const ReloadComponent = () => {
    return <Navigate to="/" replace />;
  };

  // Конфигурация для сообщений после монтирования компонента
  useEffect(() => {
    if (messageConfigRef.current) return;
    messageConfigRef.current = true;

    // Уничтожаем все предыдущие сообщения и контейнеры
    message.destroy();

    // Удаляем все существующие контейнеры сообщений
    const existingContainers = document.querySelectorAll('.ant-message');
    existingContainers.forEach(container => container.remove());

    // Настраиваем message API
    message.config({
      top: 20,
      duration: 3,
      maxCount: 3,
      rtl: false,
      getContainer: () => document.body,
    });
  }, []);

  const getAllRoutes = useMemo(() => {
    const getAllRoutesRecursive = (
      routes: RouteItem[],
      basePath = ''
    ): Array<{ path: string; element: React.ReactElement }> => {
      let allRoutes: Array<{ path: string; element: React.ReactElement }> = [];

      routes.forEach(route => {
        const fullPath = `${basePath}${route.path}`;
        // Обертываем элемент в ProtectedRoute для проверки доступа
        const protectedElement = (
          <ProtectedRoute isAdmin={isAdmin} path={fullPath}>
            {route.element}
          </ProtectedRoute>
        );
        allRoutes.push({ path: fullPath, element: protectedElement });

        if (route.children) {
          allRoutes = allRoutes.concat(getAllRoutesRecursive(route.children, fullPath));
        }
      });

      return allRoutes;
    };

    return getAllRoutesRecursive(routersData);
  }, [isAdmin]);

  // Показываем экран загрузки во время инициализации Keycloak
  if (isLoading) {
    return (
      <QueryClientProvider client={queryClient}>
        <ConfigProvider locale={ruRU}>
          <AntApp>
            <LoadingPage isLoading={isLoading} />
          </AntApp>
        </ConfigProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={ruRU}>
        <AntApp>
          <div>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Content username={username || ''} isAdmin={isAdmin} />}>
                  <Route path="/reload" element={<ReloadComponent />} />
                  <>
                    {getAllRoutes.map((item, index) => (
                      <Route
                        key={`${item.path}-${index}`}
                        path={item.path}
                        element={item.element}
                      />
                    ))}
                    <Route
                      path="/admin/laboratory/:laboratoryId"
                      element={
                        <ProtectedRoute isAdmin={isAdmin} path="/admin/laboratory/:laboratoryId">
                          <AdminPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/laboratory/:laboratoryId/department/:departmentId"
                      element={
                        <ProtectedRoute
                          isAdmin={isAdmin}
                          path="/admin/laboratory/:laboratoryId/department/:departmentId"
                        >
                          <AdminPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/samples" element={<SamplesPage />} />
                    <Route path="/samples/laboratory/:laboratoryId" element={<SamplesPage />} />
                    <Route
                      path="/samples/laboratory/:laboratoryId/department/:departmentId"
                      element={<SamplesPage />}
                    />
                    <Route path="/protocols" element={<ProtocolsPage />} />
                    <Route path="/protocols/laboratory/:laboratoryId" element={<ProtocolsPage />} />
                    <Route
                      path="/protocols/laboratory/:laboratoryId/department/:departmentId"
                      element={<ProtocolsPage />}
                    />
                    <Route path="/equipment" element={<EquipmentPage />} />
                    <Route path="/equipment/laboratory/:laboratoryId" element={<EquipmentPage />} />
                    <Route
                      path="/equipment/laboratory/:laboratoryId/department/:departmentId"
                      element={<EquipmentPage />}
                    />
                    <Route path="*" element={<Page404 />} />
                  </>
                </Route>
              </Routes>
            </BrowserRouter>
          </div>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
