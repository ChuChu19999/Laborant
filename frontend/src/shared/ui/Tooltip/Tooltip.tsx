import React from 'react';
import { Tooltip as AntTooltip } from 'antd';
import { CircleHelpIcon } from '../icons';
import '../icons/icons.css';
import './Tooltip.css';

interface TooltipLocalProps extends Omit<
  React.ComponentProps<typeof AntTooltip>,
  'placement' | 'trigger'
> {
  placement?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'focus' | 'click';
  children?: React.ReactNode;
  title?: React.ReactNode;
}

const TooltipLocal = ({
  placement = 'right',
  trigger = 'hover',
  children,
  ...props
}: TooltipLocalProps) => {
  return (
    <AntTooltip placement={placement} trigger={trigger} {...props}>
      <span className="tooltip-icon-wrapper">
        {children ?? <CircleHelpIcon size={22} className="animated-icon" />}
      </span>
    </AntTooltip>
  );
};

export default TooltipLocal;
