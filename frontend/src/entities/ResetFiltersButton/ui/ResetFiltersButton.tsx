import React, { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BiRefresh } from 'react-icons/bi';
import Button from '../../../shared/ui/Button/Button';

interface ResetFiltersButtonProps {
  onReset: () => void;
  className?: string;
}

const ResetFiltersButton: React.FC<ResetFiltersButtonProps> = ({ onReset, className }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleReset = useCallback(() => {
    onReset();
    navigate({ pathname: location.pathname, search: '' }, { replace: true });
  }, [onReset, navigate, location.pathname]);

  return (
    <Button
      type="default"
      onClick={handleReset}
      icon={<BiRefresh size={18} />}
      className={className}
    >
      Сбросить фильтры
    </Button>
  );
};

export default ResetFiltersButton;
