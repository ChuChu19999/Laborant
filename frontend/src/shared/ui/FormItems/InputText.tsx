import React from 'react';
import { Input as AntInput } from 'antd';
import './FormItems.css';

const InputText = ({
  style,
  className,
  ...props
}: React.ComponentProps<typeof AntInput.TextArea>) => {
  return (
    <AntInput.TextArea
      className={['form-item-control', className].filter(Boolean).join(' ')}
      style={{ width: '100%', ...style }}
      {...props}
    />
  );
};

export default InputText;
