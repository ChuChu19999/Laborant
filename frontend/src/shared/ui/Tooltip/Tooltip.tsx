import React from 'react';
import { Tooltip as AntTooltip } from 'antd';
import { BiHelpCircle } from 'react-icons/bi';
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
      {children || (
        <span className="tooltip-icon-wrapper">
          <BiHelpCircle size={22} />
        </span>
      )}
    </AntTooltip>
  );
};

export default TooltipLocal;
