import { Helmet } from 'react-helmet';
import { SettingsIcon } from '../icons';
import '../icons/icons.css';
import './Layout.css';

interface LayoutProps {
  title: string;
  settings?: boolean;
  headerClassName?: string;
  bodyClassName?: string;
  onSettingsClick?: () => void;
  children?: React.ReactNode;
}

const Layout = ({
  title,
  settings,
  headerClassName,
  bodyClassName,
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
          <SettingsIcon
            size={25}
            className="header-settings animated-icon"
            onClick={onSettingsClick}
          />
        )}
      </div>
      <div className="content">{children}</div>
    </div>
  </div>
);

export default Layout;
