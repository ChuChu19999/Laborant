import { Button as AntButton } from 'antd';
import './Button.css';

interface ButtonLocalProps extends React.ComponentProps<typeof AntButton> {
  title?: string;
  buttonColor?: string;
  wrapperStyle?: string;
  /** Рендерит кнопку без обёртки button-wrapper. */
  unwrapped?: boolean;
}

const ButtonLocal = ({
  title,
  buttonColor,
  wrapperStyle,
  style,
  unwrapped = false,
  ...props
}: ButtonLocalProps) => {
  const buttonStyle = buttonColor ? { ...style, backgroundColor: buttonColor } : style;

  const button = (
    <AntButton style={buttonStyle} {...props}>
      {title || props.children}
    </AntButton>
  );

  if (unwrapped) {
    return button;
  }

  return <div className={`button-wrapper ${wrapperStyle || ''}`}>{button}</div>;
};

export default ButtonLocal;
