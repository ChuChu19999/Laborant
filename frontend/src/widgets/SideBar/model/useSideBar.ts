import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PAGE_STATE_KEYS } from '@/shared/config';
import { usePageState } from '@/shared/model';
import { buildSidebarRoutes, isPathActive } from '../lib/buildSidebarRoutes';
import type { SidebarRouteItem } from '../ui/SideBar';
import type { UserPermissions } from '@/entities/Role';

type UseSideBarParams = {
  routes: SidebarRouteItem[];
  isAdmin: boolean;
  permissionsData: UserPermissions;
  onMinimizeChange?: (value: boolean) => void;
};

/** Оркестрация сайдбара: права меню, свернутость, подменю, навигация с restore page state. */
export const useSideBar = ({
  routes,
  isAdmin,
  permissionsData,
  onMinimizeChange,
}: UseSideBarParams) => {
  const [minimize, setMinimize] = useState(false);
  const [openSubmenus, setOpenSubmenus] = useState<string[]>([]);
  const buttonRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const adminPageState = usePageState({
    storageKey: PAGE_STATE_KEYS.ADMIN_PAGE,
    shouldSave: pathname => pathname.startsWith('/admin/laboratory/'),
    shouldRemove: pathname =>
      pathname === '/laboratory-management' ||
      (pathname === '/' && !pathname.startsWith('/admin/laboratory/')),
  });

  const samplesPageState = usePageState({
    storageKey: PAGE_STATE_KEYS.SAMPLES_PAGE,
    shouldSave: pathname => pathname.startsWith('/samples'),
  });

  const protocolsPageState = usePageState({
    storageKey: PAGE_STATE_KEYS.PROTOCOLS_PAGE,
    shouldSave: pathname => pathname.startsWith('/protocols'),
  });

  const equipmentPageState = usePageState({
    storageKey: PAGE_STATE_KEYS.EQUIPMENT_PAGE,
    shouldSave: pathname => pathname.startsWith('/equipment'),
  });

  const samplingLocationsPageState = usePageState({
    storageKey: PAGE_STATE_KEYS.SAMPLING_LOCATIONS_PAGE,
    shouldSave: pathname => pathname.startsWith('/sampling-locations'),
  });

  const ndNormsPageState = usePageState({
    storageKey: PAGE_STATE_KEYS.ND_NORMS_PAGE,
    shouldSave: pathname => pathname.startsWith('/nd-norms'),
  });

  const refractionTablesPageState = usePageState({
    storageKey: PAGE_STATE_KEYS.REFRACTION_TABLES_PAGE,
    shouldSave: pathname => pathname.startsWith('/refraction-tables'),
  });

  const laboratoryManagementPageState = usePageState({
    storageKey: PAGE_STATE_KEYS.LABORATORY_MANAGEMENT_PAGE,
    shouldSave: pathname => pathname.startsWith('/laboratory-management'),
    shouldRemove: pathname => !pathname.startsWith('/laboratory-management'),
  });

  const allowedRoutes = useMemo(
    () => buildSidebarRoutes(routes, isAdmin, permissionsData),
    [isAdmin, permissionsData, routes]
  );

  const toggleSubmenu = (path: string, level = 0) => {
    setOpenSubmenus(prev => {
      const isOpen = prev.includes(path);
      if (level === 0) {
        return isOpen ? [] : [path];
      }
      if (isOpen) {
        return prev.filter(item => !item.startsWith(path));
      }
      return [...prev, path];
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openSubmenus.length && !buttonRef.current?.contains(event.target as Node)) {
        setOpenSubmenus([]);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openSubmenus.length]);

  const toggleMenu = () => {
    const newMinimize = !minimize;
    setMinimize(newMinimize);
    onMinimizeChange?.(newMinimize);
    setOpenSubmenus([]);
  };

  const expandMenu = () => {
    setMinimize(false);
    onMinimizeChange?.(false);
  };

  const navigateTo = useCallback(
    (targetPath: string) => {
      const go = (pathname: string, search = '') => {
        void navigate({ pathname, search }, { replace: true });
        setOpenSubmenus([]);
      };

      if (targetPath === '/') {
        go('/');
        return;
      }

      if (targetPath === '/laboratory-management') {
        if (adminPageState.restoreState()) {
          setOpenSubmenus([]);
          return;
        }
        if (laboratoryManagementPageState.restoreState('/laboratory-management', '')) {
          setOpenSubmenus([]);
          return;
        }
        go(targetPath);
        return;
      }

      if (targetPath === '/samples') {
        if (samplesPageState.restoreState('/samples', '')) {
          setOpenSubmenus([]);
          return;
        }
        go(targetPath);
        return;
      }

      if (targetPath === '/protocols') {
        if (protocolsPageState.restoreState('/protocols', '')) {
          setOpenSubmenus([]);
          return;
        }
        go(targetPath);
        return;
      }

      if (targetPath === '/equipment') {
        if (equipmentPageState.restoreState('/equipment', '')) {
          setOpenSubmenus([]);
          return;
        }
        go(targetPath);
        return;
      }

      if (targetPath === '/sampling-locations') {
        if (samplingLocationsPageState.restoreState('/sampling-locations', '')) {
          setOpenSubmenus([]);
          return;
        }
        go(targetPath);
        return;
      }

      if (targetPath === '/nd-norms') {
        if (ndNormsPageState.restoreState('/nd-norms', '')) {
          setOpenSubmenus([]);
          return;
        }
        go(targetPath);
        return;
      }

      if (targetPath === '/refraction-tables') {
        if (refractionTablesPageState.restoreState('/refraction-tables', '')) {
          setOpenSubmenus([]);
          return;
        }
        go(targetPath);
        return;
      }

      go(targetPath);
    },
    [
      adminPageState,
      equipmentPageState,
      laboratoryManagementPageState,
      navigate,
      ndNormsPageState,
      protocolsPageState,
      refractionTablesPageState,
      samplesPageState,
      samplingLocationsPageState,
    ]
  );

  const isRouteActive = (routePath: string) => isPathActive(location.pathname, routePath);

  return {
    minimize,
    openSubmenus,
    buttonRef,
    allowedRoutes,
    toggleSubmenu,
    toggleMenu,
    expandMenu,
    navigateTo,
    isRouteActive,
  };
};
