import './Bubble.css';

interface BubbleProps {
  text: string;
  color?: string;
  textColor?: string;
}

const Bubble = ({ text, color = '#007DFE', textColor = '#fff' }: BubbleProps) => {
  return (
    <div
      className="bubble-wrapper"
      style={
        {
          '--bubble-bg-color': color,
          '--bubble-text-color': textColor,
        } as React.CSSProperties
      }
    >
      <p>{text}</p>
    </div>
  );
};

export default Bubble;
