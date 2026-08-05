import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType, Ref } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BiChevronRight, BiChevronsRight, BiUser } from 'react-icons/bi';
import logoImage from '../../../shared/assets/logo/logo.png';
import { resolveNavigationKey } from '../../../shared/config/permissions';
import { PAGE_STATE_KEYS } from '../../../shared/lib/pageStateKeys';
import { usePageState } from '../../../shared/model/hooks';
import type { UserPermissions } from '../../../shared/api/userRole';
import type { AnimatedIconHandle } from '../../../shared/ui/icons';
import '../../../shared/ui/icons/icons.css';
import './SideBar.css';

export type SidebarIconProps = {
  size?: number;
  className?: string;
  ref?: Ref<AnimatedIconHandle>;
};

export type SidebarIconComponent = ComponentType<SidebarIconProps>;

export type SidebarRouteItem = {
  label: string;
  path: string;
  Icon: SidebarIconComponent;
  children?: SidebarRouteItem[];
  menuGroup?: boolean;
  doNotShowChildrenInSideBar?: boolean;
};

interface SideBarProps {
  routes: SidebarRouteItem[];
  username: string;
  isAdmin: boolean;
  permissionsData: UserPermissions;
  onMinimizeChange?: (value: boolean) => void;
}

type RouterItem = SidebarRouteItem;

function isLeafRouteAccessible(
  route: RouterItem,
  isAdmin: boolean,
  permissionsData: UserPermissions
): boolean {
  if (isAdmin || permissionsData.is_admin) {
    return true;
  }

  const navKey = resolveNavigationKey(route.path);
  if (navKey === 'help' || navKey === 'home') {
    return true;
  }
  if (navKey === 'roles' || navKey === 'test_objects') {
    return false;
  }
  if (navKey === 'admin') {
    return Boolean(permissionsData.permissions.laboratory_management.access);
  }
  if (navKey && navKey in permissionsData.permissions.navigation) {
    return Boolean(
      permissionsData.permissions.navigation[
        navKey as keyof typeof permissionsData.permissions.navigation
      ]
    );
  }
  return false;
}

/** Собрать меню: пустые группы скрыть, одну доступную вкладку поднять на верхний уровень. */
function buildSidebarRoutes(
  routes: RouterItem[],
  isAdmin: boolean,
  permissionsData: UserPermissions
): RouterItem[] {
  const result: RouterItem[] = [];

  for (const route of routes) {
    if (route.menuGroup && route.children) {
      const children = route.children.filter(child =>
        isLeafRouteAccessible(child, isAdmin, permissionsData)
      );
      if (children.length === 0) {
        continue;
      }
      if (children.length === 1) {
        result.push(children[0]);
        continue;
      }
      result.push({ ...route, children });
      continue;
    }

    if (isLeafRouteAccessible(route, isAdmin, permissionsData)) {
      result.push(route);
    }
  }

  return result;
}

function isPathActive(pathname: string, routePath: string): boolean {
  if (routePath === '/') {
    return pathname === '/';
  }
  if (routePath === '/laboratory-management') {
    return (
      pathname.startsWith('/laboratory-management') || pathname.startsWith('/admin/laboratory/')
    );
  }
  return pathname === routePath || pathname.startsWith(`${routePath}/`);
}

interface SidebarMenuRowProps {
  Icon: SidebarIconComponent;
  label: string;
  isActive: boolean;
  level: number;
  hasChildren: boolean;
  isOpen: boolean;
  onClick: (e: React.MouseEvent) => void;
}

/** Пункт меню: анимация иконки на hover всей строки. */
const SidebarMenuRow = ({
  Icon,
  label,
  isActive,
  level,
  hasChildren,
  isOpen,
  onClick,
}: SidebarMenuRowProps) => {
  const iconRef = useRef<AnimatedIconHandle>(null);

  return (
    <div
      className={`${isActive ? 'menu-item-active' : 'menu-item'} item-level-${level} menu-item-transition`}
      onClick={onClick}
      onMouseEnter={() => iconRef.current?.startAnimation()}
      onMouseLeave={() => iconRef.current?.stopAnimation()}
    >
      <Icon ref={iconRef} size={20} className="animated-icon" />
      <span className="menu-item-label">{label}</span>
      {hasChildren && (
        <BiChevronRight
          className={`menu-item-chevron${isOpen ? ' menu-item-chevron--open' : ''}`}
          size={18}
        />
      )}
    </div>
  );
};

const SideBar = ({
  routes,
  username,
  isAdmin,
  permissionsData,
  onMinimizeChange,
}: SideBarProps) => {
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

  const laboratoryManagementPageState = usePageState({
    storageKey: PAGE_STATE_KEYS.LABORATORY_MANAGEMENT_PAGE,
    shouldSave: pathname => pathname.startsWith('/laboratory-management'),
    shouldRemove: pathname => !pathname.startsWith('/laboratory-management'),
  });

  const allowedRoutes = useMemo(
    () => buildSidebarRoutes(routes, isAdmin, permissionsData),
    [isAdmin, permissionsData, routes]
  );

  const toggleSubmenu = useCallback((path: string, level = 0) => {
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
  }, []);

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

  const navigateTo = useCallback(
    (targetPath: string) => {
      const go = (pathname: string, search = '') => {
        navigate({ pathname, search }, { replace: true });
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

      go(targetPath);
    },
    [
      adminPageState,
      equipmentPageState,
      laboratoryManagementPageState,
      navigate,
      ndNormsPageState,
      protocolsPageState,
      samplesPageState,
      samplingLocationsPageState,
    ]
  );

  const renderItems = (items: RouterItem[], level = 0) =>
    items.map(item => {
      const currentPath = item.path;
      const isOpen = openSubmenus.includes(currentPath);
      const hasVisibleChildren = Boolean(item.children?.length && !item.doNotShowChildrenInSideBar);
      const isChildActive = Boolean(
        item.children?.some(child => isPathActive(location.pathname, child.path))
      );
      const isCurrentPath =
        (!hasVisibleChildren && isPathActive(location.pathname, currentPath)) ||
        (hasVisibleChildren && (isOpen || isChildActive));

      const openSubmenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMinimize(false);
        toggleSubmenu(currentPath, level);
      };

      return (
        <li key={currentPath} className="sidebar-item">
          <SidebarMenuRow
            Icon={item.Icon}
            label={item.label}
            isActive={isCurrentPath}
            level={level}
            hasChildren={hasVisibleChildren}
            isOpen={isOpen}
            onClick={hasVisibleChildren ? openSubmenu : () => navigateTo(currentPath || '/')}
          />

          {hasVisibleChildren && (
            <ul
              className={`submenu level-${level + 1}${isOpen ? ' submenu-open' : ''}`}
              aria-hidden={!isOpen}
            >
              <div className="submenu-body">
                <div className="submenu-title">{item.label}</div>
                {renderItems(item.children || [], level + 1)}
              </div>
            </ul>
          )}
        </li>
      );
    });

  return (
    <div ref={buttonRef} className={`sidebar-wrapper ${minimize ? 'collapsed' : ''}`}>
      <div className="content">
        <div className="logo-container">
          <img
            src={logoImage}
            alt="Laborant"
            className={`sidebar-logo ${minimize ? 'collapsed' : ''}`}
            onClick={() => navigateTo('/')}
            onMouseEnter={e => {
              e.currentTarget.style.opacity = '0.8';
              e.currentTarget.style.transform = 'scale(1.03)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          />
        </div>

        <ul className="sidebar">{renderItems(allowedRoutes)}</ul>
      </div>

      <div className="footer">
        <BiChevronsRight className="arrowButton" size={25} onClick={toggleMenu} />

        <div className="user">
          <BiUser className="user-icon" size={25} />

          {!minimize && username && <p className="user-name">{username}</p>}
        </div>
      </div>
    </div>
  );
};

export default SideBar;
