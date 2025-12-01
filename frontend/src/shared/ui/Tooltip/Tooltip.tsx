import React from 'react';
import { Tooltip as AntTooltip } from 'antd';
import { BiQuestionMark } from 'react-icons/bi';

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
      {children || <BiQuestionMark size={20} />}
    </AntTooltip>
  );
};

export default TooltipLocal;
