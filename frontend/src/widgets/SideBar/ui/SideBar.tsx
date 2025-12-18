import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BiChevronsRight, BiUser } from 'react-icons/bi';
import { routersData } from '../../../app/data';
import logoImage from '../../../shared/assets/logo/logo.png';
import { PAGE_STATE_KEYS } from '../../../shared/lib/pageStateKeys';
import { usePageState } from '../../../shared/model/hooks';
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

  // Используем хуки для сохранения и восстановления состояний страниц
  const adminPageState = usePageState({
    storageKey: PAGE_STATE_KEYS.ADMIN_PAGE,
    shouldSave: pathname => pathname.startsWith('/admin/laboratory/'),
    shouldRemove: pathname => pathname === '/' && !pathname.startsWith('/admin/laboratory/'),
  });

  const samplesPageState = usePageState({
    storageKey: PAGE_STATE_KEYS.SAMPLES_PAGE,
    shouldSave: pathname => pathname.startsWith('/samples'),
  });

  const protocolsPageState = usePageState({
    storageKey: PAGE_STATE_KEYS.PROTOCOLS_PAGE,
    shouldSave: pathname => pathname.startsWith('/protocols'),
  });

  const mainPageState = usePageState({
    storageKey: PAGE_STATE_KEYS.MAIN_PAGE,
    shouldSave: (pathname, search) => {
      if (pathname !== '/') return false;
      const searchParams = new URLSearchParams(search);
      return (
        searchParams.get('page') === 'laboratory-management' ||
        searchParams.get('viewMode') === 'departments' ||
        searchParams.get('viewMode') === 'laboratories'
      );
    },
    shouldRemove: (pathname, search) => {
      if (pathname !== '/') return false;
      const searchParams = new URLSearchParams(search);
      return (
        searchParams.get('page') !== 'laboratory-management' &&
        searchParams.get('viewMode') !== 'departments' &&
        searchParams.get('viewMode') !== 'laboratories'
      );
    },
  });

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
            (currentPath === '/' &&
              (location.pathname.startsWith('/admin/laboratory/') ||
                location.pathname.startsWith('/?page=laboratory-management'))) ||
            (currentPath === '/samples' && location.pathname.startsWith('/samples')) ||
            (currentPath === '/protocols' && location.pathname.startsWith('/protocols')))) ||
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

        // Если мы находимся в управлении лабораториями/подразделениями и кликаем на "Главная", не делаем навигацию
        if (targetPath === '/' && location.pathname === '/') {
          const searchParams = new URLSearchParams(location.search);
          const isInLaboratoryManagement =
            searchParams.get('page') === 'laboratory-management' ||
            searchParams.get('viewMode') === 'departments' ||
            searchParams.get('viewMode') === 'laboratories';
          if (isInLaboratoryManagement) {
            return;
          }
        }

        // Если переходим на главную, проверяем сохраненный путь AdminPage или состояние управления лабораториями
        if (targetPath === '/') {
          if (adminPageState.restoreState()) {
            setOpenSubmenus([]);
            return;
          }
          if (mainPageState.restoreState()) {
            setOpenSubmenus([]);
            return;
          }
          // Если сохраненного пути нет, сохраняем текущие параметры URL
          const search = location.search;
          navigate({ pathname: targetPath, search }, { replace: true });
          setOpenSubmenus([]);
          return;
        }

        // Если переходим на samples, проверяем сохраненный путь samples
        if (targetPath === '/samples') {
          if (samplesPageState.restoreState('/samples', '')) {
            setOpenSubmenus([]);
            return;
          }
          // Если сохраненного пути нет, переходим на базовый путь без параметров
          navigate({ pathname: targetPath, search: '' }, { replace: true });
          setOpenSubmenus([]);
          return;
        }

        // Если переходим на protocols, проверяем сохраненный путь protocols
        if (targetPath === '/protocols') {
          if (protocolsPageState.restoreState('/protocols', '')) {
            setOpenSubmenus([]);
            return;
          }
          // Если сохраненного пути нет, переходим на базовый путь без параметров
          navigate({ pathname: targetPath, search: '' }, { replace: true });
          setOpenSubmenus([]);
          return;
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
              // При клике на логотип всегда сбрасываем URL и переходим на главную без параметров
              navigate({ pathname: '/', search: '' }, { replace: true });
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
