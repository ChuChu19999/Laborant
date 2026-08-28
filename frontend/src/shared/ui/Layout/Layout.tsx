import { Helmet } from 'react-helmet';
import { SettingsIcon } from '../icons';
import './Layout.css';

interface LayoutProps {
  title: string;
  settings?: boolean;
  headerClassName?: string;
  bodyClassName?: string;
  contentClassName?: string;
  onSettingsClick?: () => void;
  children?: React.ReactNode;
}

const Layout = ({
  title,
  settings,
  headerClassName,
  bodyClassName,
  contentClassName,
  onSettingsClick,
  children,
}: LayoutProps) => (
  <div className={`layout-wrapper ${bodyClassName || ''}`}>
    <Helmet>
      <title>{title}</title>
    </Helmet>
    <div className={`layout ${bodyClassName || ''}`}>
      <div className={`${headerClassName || ''} header`}>
        <p className="header-text">{title}</p>
        {settings && (
          <button
            type="button"
            className="header-settings"
            aria-label="Настройки"
            onClick={onSettingsClick}
          >
            <SettingsIcon size={25} className="animated-icon" />
          </button>
        )}
      </div>
      <div className={['content', contentClassName].filter(Boolean).join(' ')}>{children}</div>
    </div>
  </div>
);

export default Layout;
