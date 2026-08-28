import React from 'react';
import { Input as AntInput } from 'antd';
import type { InputRef } from 'antd';
import './FormItems.css';

const Input = ({ style, className, ...props }: React.ComponentProps<typeof AntInput>) => {
  return (
    <AntInput
      className={['form-item-control', className].filter(Boolean).join(' ')}
      style={{ width: '100%', ...style }}
      {...props}
    />
  );
};

export type { InputRef };
export default Input;
