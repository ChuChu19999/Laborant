import React from 'react';
import { Input as AntInput } from 'antd';

const Input = (props: React.ComponentProps<typeof AntInput>) => {
  return <AntInput {...props} />;
};

export default Input;
