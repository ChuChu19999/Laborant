import React, { useRef } from 'react';
import { BiChevronRight, BiChevronsRight, BiUser } from 'react-icons/bi';
import { logoImage } from '@/shared/assets';
import { useSideBar } from '../model/useSideBar';
import type { UserPermissions } from '@/entities/Role';
import type { AnimatedIconHandle } from '@/shared/ui/icons';
import type { ComponentType, Ref } from 'react';
import '@/shared/ui/icons';
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
  onPreloadPath?: (path: string) => void;
}

interface SidebarMenuRowProps {
  Icon: SidebarIconComponent;
  label: string;
  isActive: boolean;
  level: number;
  hasChildren: boolean;
  isOpen: boolean;
  onClick: (e: React.MouseEvent) => void;
  onIntent?: () => void;
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
  onIntent,
}: SidebarMenuRowProps) => {
  const iconRef = useRef<AnimatedIconHandle>(null);

  return (
    <button
      type="button"
      className={`${isActive ? 'menu-item-active' : 'menu-item'} item-level-${level} menu-item-transition`}
      onClick={onClick}
      onMouseEnter={() => {
        iconRef.current?.startAnimation();
        onIntent?.();
      }}
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
    </button>
  );
};

const SideBar = ({
  routes,
  username,
  isAdmin,
  permissionsData,
  onMinimizeChange,
  onPreloadPath,
}: SideBarProps) => {
  const {
    minimize,
    openSubmenus,
    buttonRef,
    allowedRoutes,
    toggleSubmenu,
    toggleMenu,
    expandMenu,
    navigateTo,
    isRouteActive,
  } = useSideBar({ routes, isAdmin, permissionsData, onMinimizeChange });

  const renderItems = (items: SidebarRouteItem[], level = 0) =>
    items.map(item => {
      const currentPath = item.path;
      const isOpen = openSubmenus.includes(currentPath);
      const hasVisibleChildren = Boolean(item.children?.length && !item.doNotShowChildrenInSideBar);
      const isChildActive = Boolean(item.children?.some(child => isRouteActive(child.path)));
      const isCurrentPath =
        (!hasVisibleChildren && isRouteActive(currentPath)) ||
        (hasVisibleChildren && (isOpen || isChildActive));

      const openSubmenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        expandMenu();
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
            onIntent={
              hasVisibleChildren || !onPreloadPath
                ? undefined
                : () => onPreloadPath(currentPath || '/')
            }
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
          <button
            type="button"
            className="sidebar-logo-button"
            onClick={() => navigateTo('/')}
            aria-label="На главную"
          >
            <img
              src={logoImage}
              alt="Laborant"
              className={`sidebar-logo ${minimize ? 'collapsed' : ''}`}
            />
          </button>
        </div>

        <ul className="sidebar">{renderItems(allowedRoutes)}</ul>
      </div>

      <div className="footer">
        <button
          type="button"
          className="arrowButton"
          onClick={toggleMenu}
          aria-label={minimize ? 'Развернуть меню' : 'Свернуть меню'}
        >
          <BiChevronsRight size={25} />
        </button>

        <div className="user">
          <BiUser className="user-icon" size={25} />

          {!minimize && username && <p className="user-name">{username}</p>}
        </div>
      </div>
    </div>
  );
};

export default SideBar;
