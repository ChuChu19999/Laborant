import React from 'react';
import { Select as AntSelect } from 'antd';
import './FormItems.css';

interface SelectLocalProps extends React.ComponentProps<typeof AntSelect> {
  className?: string;
}

const SelectLocal = ({
  className,
  style,
  onOpenChange,
  onDropdownVisibleChange,
  ...props
}: SelectLocalProps) => {
  return (
    <AntSelect
      className={['form-item-control', className || 'select'].filter(Boolean).join(' ')}
      style={{ width: '100%', ...style }}
      onOpenChange={onOpenChange ?? onDropdownVisibleChange}
      {...props}
    />
  );
};

SelectLocal.Option = AntSelect.Option;

export default SelectLocal;
