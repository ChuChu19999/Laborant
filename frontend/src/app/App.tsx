import { Suspense, useEffect, useMemo } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import { LoadingPage } from '@/pages/LoadingPage';
import { sidebarRoutes } from '@/widgets/SideBar';
import { installClientErrorReporter } from '@/entities/Monitoring';
import { NotifyProvider } from '@/shared/lib/notify';
import { RouteFallback } from '@/shared/ui/RouteFallback';
import { AppErrorBoundary } from './AppErrorBoundary';
import { ProtectedRoute, useAxiosInterceptors, useCurrentPermissions, useKeycloak } from './auth';
import { AppLayout } from './layouts';
import {
  AdminPage,
  HelpPage,
  CalculationsPage,
  EquipmentPage,
  ForbiddenPage,
  LaboratoryManagementPage,
  NdNormsPage,
  NotFoundPage,
  ProtocolsPage,
  RefractionTablesPage,
  RolesPage,
  RolePermissionsPage,
  SamplesPage,
  SampleTypesPage,
  SamplingLocationsPage,
  TestObjectsPage,
  TestPurposesPage,
  MainPage,
  MonitoringPage,
} from './lazyPages';
import { preloadAppPages } from './preloadPages';
import { PresenceHeartbeat } from './PresenceHeartbeat';
import type { UserPermissions } from './auth';
import type { SidebarRouteItem } from '@/widgets/SideBar';
import '@/shared/assets';
import './App.css';

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

function AppRoutes({
  username,
  permissionsData,
}: {
  username: string;
  permissionsData: UserPermissions;
}) {
  const isAdmin = permissionsData.is_admin;

  useEffect(() => {
    preloadAppPages();
  }, []);

  const getAllRoutes = useMemo(() => {
    const elementByPath: Record<string, React.ReactElement> = {
      '/': <MainPage />,
      '/samples': <SamplesPage />,
      '/protocols': <ProtocolsPage />,
      '/equipment': <EquipmentPage />,
      '/sampling-locations': <SamplingLocationsPage />,
      '/sample-types': <SampleTypesPage />,
      '/test-purposes': <TestPurposesPage />,
      '/nd-norms': <NdNormsPage />,
      '/refraction-tables': <RefractionTablesPage />,
      '/laboratory-management': <LaboratoryManagementPage />,
      '/test-objects': <TestObjectsPage />,
      '/roles': <RolesPage />,
      '/monitoring': <MonitoringPage />,
      '/help': <HelpPage />,
    };

    const getAllRoutesRecursive = (
      routes: SidebarRouteItem[],
      basePath = ''
    ): { path: string; element: React.ReactElement }[] => {
      let allRoutes: { path: string; element: React.ReactElement }[] = [];

      routes.forEach(route => {
        if (route.menuGroup) {
          if (route.children) {
            allRoutes = allRoutes.concat(getAllRoutesRecursive(route.children, ''));
          }
          return;
        }

        const fullPath = route.path.startsWith('/') ? route.path : `${basePath}${route.path}`;
        const element = elementByPath[fullPath];
        if (!element) {
          return;
        }
        const protectedElement = (
          <ProtectedRoute permissionsData={permissionsData} path={fullPath}>
            {element}
          </ProtectedRoute>
        );
        allRoutes.push({ path: fullPath, element: protectedElement });

        if (route.children) {
          allRoutes = allRoutes.concat(getAllRoutesRecursive(route.children, fullPath));
        }
      });

      return allRoutes;
    };

    return getAllRoutesRecursive(sidebarRoutes);
  }, [permissionsData]);

  if (!permissionsData.access_granted) {
    return (
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="*" element={<ForbiddenPage />} />
          </Routes>
        </Suspense>
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
      <PresenceHeartbeat enabled={permissionsData.access_granted} />
      <Routes>
        <Route
          path="/"
          element={
            <AppLayout
              username={username || ''}
              isAdmin={isAdmin}
              permissionsData={permissionsData}
            />
          }
        >
          <Route path="/reload" element={<Navigate to="/" replace />} />
          <Route path="/403" element={<ForbiddenPage />} />
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
              path="/sample-types/laboratory/:laboratoryId"
              element={wrap('/sample-types/laboratory/:laboratoryId', <SampleTypesPage />)}
            />
            <Route
              path="/sample-types/laboratory/:laboratoryId/department/:departmentId"
              element={wrap(
                '/sample-types/laboratory/:laboratoryId/department/:departmentId',
                <SampleTypesPage />
              )}
            />
            <Route
              path="/test-purposes/laboratory/:laboratoryId"
              element={wrap('/test-purposes/laboratory/:laboratoryId', <TestPurposesPage />)}
            />
            <Route
              path="/test-purposes/laboratory/:laboratoryId/department/:departmentId"
              element={wrap(
                '/test-purposes/laboratory/:laboratoryId/department/:departmentId',
                <TestPurposesPage />
              )}
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
            <Route path="*" element={<NotFoundPage />} />
          </>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function AppContent() {
  const { isLoading: isKeycloakLoading, username } = useKeycloak();
  useAxiosInterceptors();

  const { isLoading: isPermissionsLoading, data: permissionsData } = useCurrentPermissions({
    isKeycloakReady: !isKeycloakLoading,
  });

  useEffect(() => {
    installClientErrorReporter();
  }, []);

  if (isKeycloakLoading || isPermissionsLoading) {
    return <LoadingPage isLoading />;
  }

  return (
    <AppErrorBoundary>
      <AppRoutes username={username || ''} permissionsData={permissionsData} />
    </AppErrorBoundary>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={ruRU}
        theme={{
          token: {
            fontFamily: 'HeliosCondC, sans-serif',
            borderRadius: 8,
            colorPrimary: '#1677ff',
            colorBorder: '#d9d9d9',
            fontSize: 14,
            colorError: '#ff4d4f',
            colorWarning: '#faad14',
            colorSuccess: '#52c41a',
            colorTextLightSolid: '#ffffff',
            colorTextDisabled: 'rgba(0, 0, 0, 0.65)',
            colorBgContainerDisabled: '#f5f5f5',
          },
          components: {
            Button: {
              dangerColor: '#ff4d07',
              primaryColor: '#ffffff',
              solidTextColor: '#ffffff',
            },
            Select: {
              optionFontSize: 14,
              optionPadding: '6px 12px',
              borderRadius: 8,
            },
            Input: {
              fontSize: 14,
              borderRadius: 8,
            },
            DatePicker: {
              fontSize: 14,
              borderRadius: 8,
            },
            Message: {
              contentBg: '#ffffff',
              contentPadding: '12px 20px',
            },
          },
        }}
      >
        <AntApp
          message={{
            top: 20,
            duration: 3,
            maxCount: 3,
          }}
        >
          <NotifyProvider>
            <AppContent />
          </NotifyProvider>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
