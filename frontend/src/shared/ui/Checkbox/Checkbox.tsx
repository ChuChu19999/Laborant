import { Checkbox as AntCheckbox } from 'antd';
import type { CheckboxProps } from 'antd';
import type { ReactNode } from 'react';
import './Checkbox.css';

interface AppCheckboxProps extends CheckboxProps {
  children?: ReactNode;
}

const Checkbox = ({ children, className, ...props }: AppCheckboxProps) => {
  const mergedClassName = ['app-checkbox', className].filter(Boolean).join(' ');
  return (
    <AntCheckbox className={mergedClassName} {...props}>
      {children}
    </AntCheckbox>
  );
};

export default Checkbox;
