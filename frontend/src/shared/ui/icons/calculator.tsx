import type { HTMLAttributes, MouseEvent } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { motion, useAnimation } from 'motion/react';
import type { Variants } from 'motion/react';

export interface CalculatorIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface CalculatorIconProps extends HTMLAttributes<HTMLSpanElement> {
  size?: number;
}

const KEY_VARIANTS: Variants = {
  normal: { opacity: 1, scale: 1 },
  animate: {
    opacity: [0.35, 1, 0.35, 1],
    scale: [1, 0.85, 1, 1],
    transition: { duration: 0.55, ease: 'easeInOut' },
  },
};

const CalculatorIcon = forwardRef<CalculatorIconHandle, CalculatorIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;
      return {
        startAnimation: () => controls.start('animate'),
        stopAnimation: () => controls.start('normal'),
      };
    });

    const handleMouseEnter = useCallback(
      (e: MouseEvent<HTMLSpanElement>) => {
        if (isControlledRef.current) {
          onMouseEnter?.(e);
        } else {
          controls.start('animate');
        }
      },
      [controls, onMouseEnter]
    );

    const handleMouseLeave = useCallback(
      (e: MouseEvent<HTMLSpanElement>) => {
        if (isControlledRef.current) {
          onMouseLeave?.(e);
        } else {
          controls.start('normal');
        }
      },
      [controls, onMouseLeave]
    );

    return (
      <span
        className={className}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="16" height="20" x="4" y="2" rx="2" />
          <line x1="8" x2="16" y1="6" y2="6" />
          <line x1="16" x2="16" y1="14" y2="18" />
          <motion.g animate={controls} initial="normal" variants={KEY_VARIANTS}>
            <path d="M16 10h.01" />
            <path d="M12 10h.01" />
            <path d="M8 10h.01" />
            <path d="M12 14h.01" />
            <path d="M8 14h.01" />
            <path d="M12 18h.01" />
            <path d="M8 18h.01" />
          </motion.g>
        </svg>
      </span>
    );
  }
);

CalculatorIcon.displayName = 'CalculatorIcon';

export { CalculatorIcon };
