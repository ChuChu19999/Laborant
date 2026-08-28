import { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SideBar, sidebarRoutes } from '@/widgets/SideBar';
import { RouteFallback } from '@/shared/ui/RouteFallback';
import { PermissionsProvider } from '../auth';
import { preloadPageByPath } from '../preloadPages';
import type { UserPermissions } from '@/entities/Role';
import './AppLayout.css';
export interface AppLayoutOutletContext {
  sidebarCollapsed: boolean;
}

interface AppLayoutProps {
  username: string;
  isAdmin: boolean;
  permissionsData: UserPermissions;
}

const AppLayout = ({ username, isAdmin, permissionsData }: AppLayoutProps) => {
  const [minimize, setMinimize] = useState(false);

  const handleMinimizeChange = (value: boolean) => {
    setMinimize(value);
  };

  return (
    <div className="content-wrapper">
      <SideBar
        routes={sidebarRoutes}
        username={username}
        isAdmin={isAdmin}
        permissionsData={permissionsData}
        onMinimizeChange={handleMinimizeChange}
        onPreloadPath={preloadPageByPath}
      />
      <PermissionsProvider value={{ isAdmin, permissionsData }}>
        <Suspense fallback={<RouteFallback />}>
          <Outlet context={{ sidebarCollapsed: minimize } satisfies AppLayoutOutletContext} />
        </Suspense>
      </PermissionsProvider>
    </div>
  );
};

export default AppLayout;
