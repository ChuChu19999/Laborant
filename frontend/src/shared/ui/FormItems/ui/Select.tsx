import React from 'react';
import { Select as AntSelect } from 'antd';
import './FormItems.css';

interface SelectLocalProps extends React.ComponentProps<typeof AntSelect> {
  className?: string;
}

const SelectLocal = (props: SelectLocalProps) => {
  return <AntSelect className={props.className || 'select'} {...props} />;
};

SelectLocal.Option = AntSelect.Option;

export default SelectLocal;
