import type { ComponentType, CSSProperties, HTMLAttributes, MouseEvent } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { motion, useAnimation } from 'motion/react';
import type { Variants } from 'motion/react';

export type AnimatedIconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

type AntdIconComponent = ComponentType<{ style?: CSSProperties; className?: string }>;

interface CreateAnimatedAntdIconOptions {
  displayName: string;
  Icon: AntdIconComponent;
  variants?: Variants;
}

const DEFAULT_VARIANTS: Variants = {
  normal: { scale: 1, rotate: 0 },
  animate: {
    scale: [1, 1.12, 1],
    rotate: [0, -10, 10, 0],
    transition: { duration: 0.45, ease: 'easeInOut' },
  },
};

export type AnimatedAntdIconProps = Omit<
  HTMLAttributes<HTMLSpanElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd'
> & {
  size?: number;
};

/** Обёртка Ant Design-иконки с hover-анимацией. */
export function createAnimatedAntdIcon({
  displayName,
  Icon,
  variants = DEFAULT_VARIANTS,
}: CreateAnimatedAntdIconOptions) {
  const AnimatedIcon = forwardRef<AnimatedIconHandle, AnimatedAntdIconProps>(
    ({ onMouseEnter, onMouseLeave, className, size = 28, style, ...props }, ref) => {
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
        <motion.span
          className={className}
          style={style}
          animate={controls}
          initial="normal"
          variants={variants}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          {...props}
        >
          <Icon style={{ fontSize: size }} />
        </motion.span>
      );
    }
  );

  AnimatedIcon.displayName = displayName;
  return AnimatedIcon;
}
