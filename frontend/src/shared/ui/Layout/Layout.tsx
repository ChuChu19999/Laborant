import { Helmet } from 'react-helmet';
import { BiCog } from 'react-icons/bi';
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
          <BiCog color="#BDBFC1" size={25} className="header-settings" onClick={onSettingsClick} />
        )}
      </div>
      <div className="content">{children}</div>
    </div>
  </div>
);

export default Layout;
