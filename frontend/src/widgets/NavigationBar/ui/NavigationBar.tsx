import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HomeOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import './NavigationBar.css';

interface Breadcrumb {
  label: string;
  onClick?: () => void;
}

interface NavigationBarProps {
  breadcrumbs?: Breadcrumb[];
  onBack?: () => void;
  onHomeClick?: () => void;
  showHome?: boolean;
  showBack?: boolean;
  disabledBack?: boolean;
}

const NavigationBar = ({
  breadcrumbs = [],
  onBack,
  onHomeClick,
  showHome = true,
  showBack = true,
  disabledBack = false,
}: NavigationBarProps) => {
  const navigate = useNavigate();

  const handleHomeClick = () => {
    if (onHomeClick) {
      onHomeClick();
    } else {
      navigate('/');
    }
  };

  const handleBackClick = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="navigation-bar">
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
          <div className="breadcrumbs">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                {index > 0 && <span className="breadcrumb-separator">/</span>}
                <span
                  className={`breadcrumb-item ${index === breadcrumbs.length - 1 ? 'active' : ''}`}
                  onClick={crumb.onClick}
                  style={{ cursor: crumb.onClick ? 'pointer' : 'default' }}
                >
                  {crumb.label}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
      {showHome && (
        <Tooltip title="На главную">
          <button type="button" className="nav-button nav-button-home" onClick={handleHomeClick}>
            <HomeOutlined />
          </button>
        </Tooltip>
      )}
    </div>
  );
};

export default NavigationBar;
