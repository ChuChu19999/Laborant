import { useEffect, useMemo, useRef } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider, message } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import '../shared/assets/fonts/fonts.css';
import './App.css';
import AdminPage from '../pages/AdminPage/AdminPage';
import CalculationsPage from '../pages/CalculationsPage/CalculationsPage';
import EquipmentPage from '../pages/EquipmentPage/EquipmentPage';
import Page403 from '../pages/ErrorPages/Page403/Page403';
import Page404 from '../pages/ErrorPages/Page404/Page404';
import LoadingPage from '../pages/LoadingPage/LoadingPage';
import NdNormsPage from '../pages/NdNormsPage/NdNormsPage';
import ProtocolsPage from '../pages/ProtocolsPage/ProtocolsPage';
import RefractionTablesPage from '../pages/RefractionTablesPage/RefractionTablesPage';
import RolePermissionsPage from '../pages/RolePermissionsPage/RolePermissionsPage';
import SamplesPage from '../pages/SamplesPage/SamplesPage';
import SamplingLocationsPage from '../pages/SamplingLocationsPage/SamplingLocationsPage';
import { useAxiosInterceptors } from '../shared/model/auth/useAxiosInterceptors';
import { useCurrentPermissions } from '../shared/model/auth/useCurrentPermissions';
import { useKeycloak } from '../shared/model/auth/useKeycloak';
import ProtectedRoute from '../shared/ui/ProtectedRoute';
import Content from './Content/Content';
import { routersData } from './data';
import type { UserPermissions } from '../shared/api/userRole';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 2,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});

interface RouteItem {
  path: string;
  element?: React.ReactElement;
  children?: RouteItem[];
  menuGroup?: boolean;
}

function AppRoutes({
  username,
  permissionsData,
}: {
  username: string;
  permissionsData: UserPermissions;
}) {
  const isAdmin = permissionsData.is_admin;

  const ReloadComponent = () => {
    return <Navigate to="/" replace />;
  };

  const getAllRoutes = useMemo(() => {
    const getAllRoutesRecursive = (
      routes: RouteItem[],
      basePath = ''
    ): Array<{ path: string; element: React.ReactElement }> => {
      let allRoutes: Array<{ path: string; element: React.ReactElement }> = [];

      routes.forEach(route => {
        if (route.menuGroup) {
          if (route.children) {
            allRoutes = allRoutes.concat(getAllRoutesRecursive(route.children, ''));
          }
          return;
        }

        const fullPath = route.path.startsWith('/') ? route.path : `${basePath}${route.path}`;
        if (!route.element) {
          return;
        }
        const protectedElement = (
          <ProtectedRoute permissionsData={permissionsData} path={fullPath}>
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

    return getAllRoutesRecursive(routersData as RouteItem[]);
  }, [permissionsData]);

  if (!permissionsData.access_granted) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<Page403 />} />
        </Routes>
      </BrowserRouter>
    );
  }

  const wrap = (path: string, element: React.ReactElement) => (
    <ProtectedRoute permissionsData={permissionsData} path={path}>
      {element}
    </ProtectedRoute>
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Content
              username={username || ''}
              isAdmin={isAdmin}
              permissionsData={permissionsData}
            />
          }
        >
          <Route path="/reload" element={<ReloadComponent />} />
          <Route path="/403" element={<Page403 />} />
          <>
            {getAllRoutes.map((item, index) => (
              <Route key={`${item.path}-${index}`} path={item.path} element={item.element} />
            ))}
            <Route
              path="/roles/:roleId/permissions"
              element={wrap('/roles/:roleId/permissions', <RolePermissionsPage />)}
            />
            <Route
              path="/admin/laboratory/:laboratoryId"
              element={wrap('/admin/laboratory/:laboratoryId', <AdminPage />)}
            />
            <Route
              path="/admin/laboratory/:laboratoryId/department/:departmentId"
              element={wrap(
                '/admin/laboratory/:laboratoryId/department/:departmentId',
                <AdminPage />
              )}
            />
            <Route path="/samples" element={wrap('/samples', <SamplesPage />)} />
            <Route
              path="/samples/laboratory/:laboratoryId/calculations"
              element={wrap('/samples/laboratory/:laboratoryId/calculations', <CalculationsPage />)}
            />
            <Route
              path="/samples/laboratory/:laboratoryId"
              element={wrap('/samples/laboratory/:laboratoryId', <SamplesPage />)}
            />
            <Route
              path="/samples/laboratory/:laboratoryId/department/:departmentId"
              element={wrap(
                '/samples/laboratory/:laboratoryId/department/:departmentId',
                <SamplesPage />
              )}
            />
            <Route
              path="/samples/laboratory/:laboratoryId/department/:departmentId/calculations"
              element={wrap(
                '/samples/laboratory/:laboratoryId/department/:departmentId/calculations',
                <CalculationsPage />
              )}
            />
            <Route path="/protocols" element={wrap('/protocols', <ProtocolsPage />)} />
            <Route
              path="/protocols/laboratory/:laboratoryId"
              element={wrap('/protocols/laboratory/:laboratoryId', <ProtocolsPage />)}
            />
            <Route
              path="/protocols/laboratory/:laboratoryId/department/:departmentId"
              element={wrap(
                '/protocols/laboratory/:laboratoryId/department/:departmentId',
                <ProtocolsPage />
              )}
            />
            <Route path="/equipment" element={wrap('/equipment', <EquipmentPage />)} />
            <Route
              path="/equipment/laboratory/:laboratoryId"
              element={wrap('/equipment/laboratory/:laboratoryId', <EquipmentPage />)}
            />
            <Route
              path="/equipment/laboratory/:laboratoryId/department/:departmentId"
              element={wrap(
                '/equipment/laboratory/:laboratoryId/department/:departmentId',
                <EquipmentPage />
              )}
            />
            <Route
              path="/sampling-locations"
              element={wrap('/sampling-locations', <SamplingLocationsPage />)}
            />
            <Route
              path="/sampling-locations/laboratory/:laboratoryId"
              element={wrap(
                '/sampling-locations/laboratory/:laboratoryId',
                <SamplingLocationsPage />
              )}
            />
            <Route
              path="/sampling-locations/laboratory/:laboratoryId/department/:departmentId"
              element={wrap(
                '/sampling-locations/laboratory/:laboratoryId/department/:departmentId',
                <SamplingLocationsPage />
              )}
            />
            <Route path="/nd-norms" element={wrap('/nd-norms', <NdNormsPage />)} />
            <Route
              path="/nd-norms/laboratory/:laboratoryId"
              element={wrap('/nd-norms/laboratory/:laboratoryId', <NdNormsPage />)}
            />
            <Route
              path="/nd-norms/laboratory/:laboratoryId/department/:departmentId"
              element={wrap(
                '/nd-norms/laboratory/:laboratoryId/department/:departmentId',
                <NdNormsPage />
              )}
            />
            <Route
              path="/refraction-tables"
              element={wrap('/refraction-tables', <RefractionTablesPage />)}
            />
            <Route
              path="/refraction-tables/laboratory/:laboratoryId"
              element={wrap(
                '/refraction-tables/laboratory/:laboratoryId',
                <RefractionTablesPage />
              )}
            />
            <Route
              path="/refraction-tables/laboratory/:laboratoryId/department/:departmentId"
              element={wrap(
                '/refraction-tables/laboratory/:laboratoryId/department/:departmentId',
                <RefractionTablesPage />
              )}
            />
            <Route path="*" element={<Page404 />} />
          </>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function AppContent() {
  const { isLoading: isKeycloakLoading, username } = useKeycloak();
  useAxiosInterceptors();

  const messageConfigRef = useRef(false);
  const { isLoading: isPermissionsLoading, data: permissionsData } = useCurrentPermissions({
    isKeycloakReady: !isKeycloakLoading,
  });

  useEffect(() => {
    if (messageConfigRef.current) return;
    messageConfigRef.current = true;

    message.destroy();

    const existingContainers = document.querySelectorAll('.ant-message');
    existingContainers.forEach(container => container.remove());

    message.config({
      top: 20,
      duration: 3,
      maxCount: 3,
      rtl: false,
      getContainer: () => document.body,
    });
  }, []);

  if (isKeycloakLoading || isPermissionsLoading) {
    return <LoadingPage isLoading />;
  }

  return <AppRoutes username={username || ''} permissionsData={permissionsData} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={ruRU}>
        <AntApp>
          <div>
            <AppContent />
          </div>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
