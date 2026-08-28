import { ArrowLeftOutlined } from '@/shared/ui/icons';
import { Tooltip } from '../Tooltip';
import './NavigationBar.css';

interface Breadcrumb {
  label: string;
  onClick?: () => void;
}

type NavigationBarProps = {
  breadcrumbs?: Breadcrumb[];
  disabledBack?: boolean;
  className?: string;
} & ({ showBack?: true; onBack: () => void } | { showBack: false; onBack?: () => void });

const NavigationBar = ({
  breadcrumbs = [],
  onBack,
  showBack = true,
  disabledBack = false,
  className,
}: NavigationBarProps) => {
  const handleBackClick = () => {
    onBack?.();
  };

  return (
    <div className={['navigation-bar', className].filter(Boolean).join(' ')}>
      <div className="navigation-bar-left">
        {showBack && (
          <Tooltip title="Назад">
            <button
              type="button"
              className={`nav-button nav-button-back ${disabledBack ? 'disabled' : ''}`}
              onClick={disabledBack ? undefined : handleBackClick}
              disabled={disabledBack}
            >
              <ArrowLeftOutlined />
            </button>
          </Tooltip>
        )}
        {breadcrumbs.length > 0 && (
          <nav className="breadcrumbs" aria-label="Навигационная цепочка">
            <ol className="breadcrumbs-list">
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1;
                const breadcrumbKey = `${index}-${crumb.label}`;

                return (
                  <li key={breadcrumbKey} className="breadcrumbs-item">
                    {index > 0 && <span className="breadcrumb-separator">/</span>}
                    {crumb.onClick && !isLast ? (
                      <button
                        type="button"
                        className="breadcrumb-item clickable"
                        onClick={crumb.onClick}
                      >
                        {crumb.label}
                      </button>
                    ) : (
                      <span
                        className={`breadcrumb-item ${isLast ? 'active' : ''}`}
                        aria-current={isLast ? 'page' : undefined}
                      >
                        {crumb.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
      </div>
    </div>
  );
};

export default NavigationBar;
