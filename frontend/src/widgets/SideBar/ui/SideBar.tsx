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

const ADMIN_PAGE_STORAGE_KEY = 'lastAdminPagePath';

const SideBar = ({ username, isAdmin, onMinimizeChange }: SideBarProps) => {
  const [minimize, setMinimize] = useState(false);
  const [openSubmenus, setOpenSubmenus] = useState<string[]>([]);
  const buttonRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

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

  useEffect(() => {
    if (location.pathname.startsWith('/admin/laboratory/')) {
      sessionStorage.setItem(ADMIN_PAGE_STORAGE_KEY, location.pathname + location.search);
    } else if (location.pathname === '/' && !location.pathname.startsWith('/admin/laboratory/')) {
      sessionStorage.removeItem(ADMIN_PAGE_STORAGE_KEY);
    }
  }, [location.pathname, location.search]);

  const renderItems = (items: RouterItem[], level = 0, parentPath = '') =>
    items.map(item => {
      const currentPath = `${parentPath}${item.path}`;
      const isOpen = openSubmenus.includes(currentPath);
      const isCurrentPath =
        ((!openSubmenus.length || level !== 0) &&
          (location.pathname === currentPath ||
            (currentPath === '/' &&
              (location.pathname.startsWith('/admin/laboratory/') ||
                location.pathname.startsWith('/?page=laboratory-management'))) ||
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
        // Если мы находимся на AdminPage и кликаем на "Главная", не делаем навигацию
        if (targetPath === '/' && location.pathname.startsWith('/admin/laboratory/')) {
          return;
        }

        // Если переходим на главную, проверяем сохраненный путь AdminPage
        if (targetPath === '/') {
          const savedAdminPath = sessionStorage.getItem(ADMIN_PAGE_STORAGE_KEY);
          if (savedAdminPath) {
            const [savedPath, savedSearch] = savedAdminPath.split('?');
            const search = savedSearch ? `?${savedSearch}` : location.search;
            navigate({ pathname: savedPath, search }, { replace: true });
            setOpenSubmenus([]);
            return;
          }
        }

        // Сохраняем query параметры при переключении страниц
        const search = location.search;
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
              // Если мы находимся на AdminPage, не делаем навигацию
              if (location.pathname.startsWith('/admin/laboratory/')) {
                return;
              }

              // Проверяем сохраненный путь AdminPage
              const savedAdminPath = sessionStorage.getItem(ADMIN_PAGE_STORAGE_KEY);
              if (savedAdminPath) {
                const [savedPath, savedSearch] = savedAdminPath.split('?');
                const search = savedSearch ? `?${savedSearch}` : location.search;
                navigate({ pathname: savedPath, search }, { replace: true });
                return;
              }

              const search = location.search;
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
