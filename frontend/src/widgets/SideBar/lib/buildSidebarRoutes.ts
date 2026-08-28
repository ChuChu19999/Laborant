import {
  getNavigationPermission,
  resolveNavigationKey,
  type UserPermissions,
} from '@/entities/Role';
import type { SidebarRouteItem } from '../ui/SideBar';

type RouterItem = SidebarRouteItem;

export function isLeafRouteAccessible(
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
  if (navKey) {
    const allowed = getNavigationPermission(permissionsData.permissions.navigation, navKey);
    if (allowed === undefined) {
      return false;
    }
    return allowed;
  }
  return false;
}

/** Собрать меню: пустые группы скрыть, одну доступную вкладку поднять на верхний уровень. */
export function buildSidebarRoutes(
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
        const onlyChild = children[0];
        if (onlyChild) {
          result.push(onlyChild);
        }
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

export function isPathActive(pathname: string, routePath: string): boolean {
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
