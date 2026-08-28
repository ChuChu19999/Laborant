import { PlusOutlined } from '@/shared/ui/icons';
import type { ReactNode } from 'react';

type AddFieldButtonProps = {
  onClick: () => void;
  children: ReactNode;
};

export function AddFieldButton({ onClick, children }: AddFieldButtonProps) {
  return (
    <button type="button" onClick={onClick} className="add-field-btn">
      <PlusOutlined className="add-field-btn-icon" aria-hidden />
      <span className="add-field-btn-label">{children}</span>
    </button>
  );
}
