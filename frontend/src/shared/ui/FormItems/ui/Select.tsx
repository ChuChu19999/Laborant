import React from 'react';
import { Select as AntSelect } from 'antd';

interface SelectLocalProps extends React.ComponentProps<typeof AntSelect> {
  className?: string;
}

const SelectLocal = (props: SelectLocalProps) => {
  return <AntSelect className={props.className || 'select'} {...props} />;
};

export default SelectLocal;
