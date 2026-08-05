import { Radio as AntRadio } from 'antd';

type RadioGroupProps = React.ComponentProps<typeof AntRadio.Group>;

const RadioGroup = (props: RadioGroupProps) => {
  return <AntRadio.Group {...props} />;
};

export default RadioGroup;
