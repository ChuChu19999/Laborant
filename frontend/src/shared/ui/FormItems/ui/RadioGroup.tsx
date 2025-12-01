import { useState } from 'react';
import { Form, Radio } from 'antd';
import FormItemWrapper from './FormItemWrapper';
import type { RadioChangeEvent } from 'antd';

interface RadioOption {
  value: number | string;
  name: string;
}

interface RatioGroupProps {
  data: RadioOption[];
  name: string;
}

const RatioGroup = ({ data, name }: RatioGroupProps) => {
  const [value, setValue] = useState<number | string>(1);

  const onChange = (e: RadioChangeEvent) => {
    setValue(e.target.value);
  };

  return (
    <FormItemWrapper>
      <Form.Item name={name}>
        <Radio.Group onChange={onChange} value={value}>
          {data.map(item => {
            return (
              <Radio value={item.value} key={item.value}>
                {item.name}
              </Radio>
            );
          })}
        </Radio.Group>
      </Form.Item>
    </FormItemWrapper>
  );
};

export default RatioGroup;
