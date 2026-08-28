import { AimOutlined, ExperimentOutlined } from '@ant-design/icons';
import { createAnimatedAntdIcon } from './CreateAnimatedAntdIcon';

/** Поступления проб — Antd Experiment с анимацией. */
export const ExperimentAntdIcon = createAnimatedAntdIcon({
  displayName: 'ExperimentAntdIcon',
  Icon: ExperimentOutlined,
  variants: {
    normal: { scale: 1, y: 0 },
    animate: {
      scale: [1, 1.1, 1],
      y: [0, -2, 0],
      transition: { duration: 0.4, ease: 'easeInOut' },
    },
  },
});

/** Объекты испытаний — Antd Aim с анимацией. */
export const AimAntdIcon = createAnimatedAntdIcon({
  displayName: 'AimAntdIcon',
  Icon: AimOutlined,
  variants: {
    normal: { scale: 1, rotate: 0 },
    animate: {
      scale: [1, 1.15, 1],
      rotate: [0, 90],
      transition: { duration: 0.45, ease: 'easeInOut' },
    },
  },
});
