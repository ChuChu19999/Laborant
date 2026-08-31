import { useRef } from 'react';
import { Button } from '../Button';
import { RefreshCwIcon, type RefreshCwIconHandle } from '../icons';

interface ResetFiltersButtonProps {
  onReset: () => void;
  className?: string;
}

const ResetFiltersButton = ({ onReset, className }: ResetFiltersButtonProps) => {
  const iconRef = useRef<RefreshCwIconHandle>(null);

  return (
    <Button
      type="default"
      onClick={onReset}
      icon={<RefreshCwIcon ref={iconRef} size={14} className="animated-icon" />}
      className={className}
      onMouseEnter={() => iconRef.current?.startAnimation()}
      onMouseLeave={() => iconRef.current?.stopAnimation()}
    >
      Сбросить фильтры
    </Button>
  );
};

export default ResetFiltersButton;
