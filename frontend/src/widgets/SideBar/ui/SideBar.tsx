import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BiChevronsRight, BiUser } from 'react-icons/bi';
import { routersData } from '../../../app/data';
import logoImage from '../../../shared/assets/logo/logo.png';
import './SideBar.css';

interface SideBarProps {
  username: string;
  isAdmin: boolean;
  onMinimizeChange?: (value: boolean) => void;
}

type RouterItem = {
  label: string;
  path: string;
  icon: React.ReactElement;
  element: React.ReactElement;
  children?: RouterItem[];
  doNotShowChildrenInSideBar?: boolean;
};

const SideBar = ({ username, isAdmin, onMinimizeChange }: SideBarProps) => {
  const [minimize, setMinimize] = useState(false);
  const [openSubmenus, setOpenSubmenus] = useState<string[]>([]);
  const buttonRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Получение базового пути страницы (первый сегмент пути)
  const getBasePath = useCallback((pathname: string): string => {
    if (pathname === '/') {
      return '/';
    }
    const segments = pathname.split('/').filter(segment => segment.length > 0);
    return segments.length > 0 ? `/${segments[0]}` : '/';
  }, []);

  // Фильтруем роуты в зависимости от роли
  // Для не-админов доступны только: главная и помощь
  const allowedRoutes = isAdmin
    ? routersData
    : routersData.filter(route => route.path === '/' || route.path === '/help');

  const toggleSubmenu = useCallback(
    (path: string, level = 0) => {
      const isOpen = openSubmenus.includes(path);

      if (level === 0) {
        if (isOpen) {
          setOpenSubmenus([]);
          return;
        }

        setOpenSubmenus([path]);
        return;
      }

      if (isOpen) {
        setOpenSubmenus(prevSubmenus => prevSubmenus.filter(item => !item.startsWith(path)));
        return;
      }

      setOpenSubmenus(prevSubmenus => [...prevSubmenus, path]);
    },
    [openSubmenus]
  );

  const openLocationSubmenus = useCallback(() => {
    let previousPath = '';

    const locationSplit = location.pathname.split('/').filter(item => item.length);

    locationSplit.pop();

    const locationPaths = locationSplit.map(item => {
      previousPath += '/' + item;
      return previousPath;
    });

    locationPaths.forEach((item, index) => toggleSubmenu(item, index));
  }, [location, toggleSubmenu]);

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

  const renderItems = (items: RouterItem[], level = 0, parentPath = '') =>
    items.map(item => {
      const currentPath = `${parentPath}${item.path}`;
      const isOpen = openSubmenus.includes(currentPath);
      const isCurrentPath =
        ((!openSubmenus.length || level !== 0) &&
          (location.pathname === currentPath ||
            (currentPath === '/users' && location.pathname.startsWith('/user-cabinet/')))) ||
        isOpen;

      const openSubmenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMinimize(false);

        if (location.pathname !== '/' && location.pathname.startsWith(currentPath)) {
          openLocationSubmenus();
          return;
        }

        toggleSubmenu(currentPath, level);
      };

      const navigateOnClick = () => {
        const targetPath = currentPath || '/';
        // Определяем базовые пути текущей и целевой страниц
        const currentBasePath = getBasePath(location.pathname);
        const targetBasePath = getBasePath(targetPath);
        // Сохраняем query параметры только если остаемся на той же странице
        const search = currentBasePath === targetBasePath ? location.search : '';
        // Делаем навигацию
        navigate({ pathname: targetPath, search }, { replace: true });
        setOpenSubmenus([]);
      };

      return (
        <li key={currentPath} className="sidebar-item">
          <div
            ref={buttonRef}
            className={`${isCurrentPath ? 'menu-item-active' : 'menu-item'} item-level-${level} menu-item-transition`}
            onClick={
              item.children?.length && !item.doNotShowChildrenInSideBar
                ? openSubmenu
                : navigateOnClick
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </div>

          {item.children?.length && !item.doNotShowChildrenInSideBar && isOpen && (
            <ul
              className={`submenu level-${level + 1} ${minimize ? 'submenu-margin-collapsed' : 'submenu-margin-expanded'}`}
            >
              <div className="submenu-title">{item.label}</div>

              {renderItems(item.children, level + 1, currentPath)}
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
            onClick={() => {
              const currentBasePath = getBasePath(location.pathname);
              const search = currentBasePath === '/' ? location.search : '';
              navigate({ pathname: '/', search }, { replace: true });
            }}
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
