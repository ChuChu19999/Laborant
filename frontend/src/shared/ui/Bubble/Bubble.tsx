import './Bubble.css';

interface BubbleProps {
  text: string;
  color?: string;
  textColor?: string;
}

const Bubble = ({ text, color = '#007DFE', textColor = '#fff' }: BubbleProps) => {
  return (
    <div className="bubble-wrapper" style={{ backgroundColor: color }}>
      <p style={{ color: textColor }}>{text}</p>
    </div>
  );
};

export default Bubble;
