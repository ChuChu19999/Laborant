import { Button as AntButton } from 'antd';
import './Button.css';

interface ButtonLocalProps extends React.ComponentProps<typeof AntButton> {
  title?: string;
  buttonColor?: string;
  wrapperStyle?: string;
}

const ButtonLocal = ({ title, buttonColor, wrapperStyle, style, ...props }: ButtonLocalProps) => {
  const buttonStyle = buttonColor ? { ...style, backgroundColor: buttonColor } : style;

  return (
    <div className={`button-wrapper ${wrapperStyle || ''}`}>
      <AntButton style={buttonStyle} {...props}>
        {title || props.children}
      </AntButton>
    </div>
  );
};

export default ButtonLocal;
