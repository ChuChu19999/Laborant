import { useLayoutEffect, useRef } from 'react';
import './Bubble.css';

interface BubbleProps {
  text: string;
  color?: string;
  textColor?: string;
}

const Bubble = ({ text, color = '#007DFE', textColor = '#fff' }: BubbleProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    el.style.setProperty('--bubble-bg-color', color);
    el.style.setProperty('--bubble-text-color', textColor);
  }, [color, textColor]);

  return (
    <div ref={wrapperRef} className="bubble-wrapper">
      <p>{text}</p>
    </div>
  );
};

export default Bubble;
