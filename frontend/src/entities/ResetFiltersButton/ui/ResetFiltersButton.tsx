import React, { useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../../../shared/ui/Button';
import { RefreshCWIcon, type RefreshCWIconHandle } from '../../../shared/ui/icons';
import '../../../shared/ui/icons/icons.css';

interface ResetFiltersButtonProps {
  onReset: () => void;
  className?: string;
}

const ResetFiltersButton: React.FC<ResetFiltersButtonProps> = ({ onReset, className }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const iconRef = useRef<RefreshCWIconHandle>(null);

  const handleReset = useCallback(() => {
    onReset();
    navigate({ pathname: location.pathname, search: '' }, { replace: true });
  }, [onReset, navigate, location.pathname]);

  return (
    <Button
      type="default"
      onClick={handleReset}
      icon={<RefreshCWIcon ref={iconRef} size={18} className="animated-icon" />}
      className={className}
      onMouseEnter={() => iconRef.current?.startAnimation()}
      onMouseLeave={() => iconRef.current?.stopAnimation()}
    >
      Сбросить фильтры
    </Button>
  );
};

export default ResetFiltersButton;
