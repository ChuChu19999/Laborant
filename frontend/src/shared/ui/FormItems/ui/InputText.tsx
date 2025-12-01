import React from 'react';
import { Input } from 'antd';

const InputText = (props: React.ComponentProps<typeof Input.TextArea>) => {
  return <Input.TextArea {...props} />;
};

export default InputText;
