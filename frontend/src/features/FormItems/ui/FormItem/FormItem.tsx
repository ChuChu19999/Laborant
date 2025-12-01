import React from 'react';
import { Divider, Form } from 'antd';
import { BiInfoCircle } from 'react-icons/bi';
import Tooltip from '../../../../shared/ui/Tooltip/Tooltip';
import './FormItem.css';

interface FormItemProps extends React.ComponentProps<typeof Form.Item> {
  title?: React.ReactNode;
  divider?: boolean;
  tooltip?: string;
  children?: React.ReactNode;
}

const FormItem = ({ title, divider, tooltip, children, ...formItemProps }: FormItemProps) => {
  return (
    <>
      <div className="form-item-container">
        <div className="form-item-label">
          {title}
          {tooltip && (
            <Tooltip title={tooltip}>
              <BiInfoCircle size={16} />
            </Tooltip>
          )}
        </div>

        <Form.Item {...formItemProps} className="form-item-field">
          {children}
        </Form.Item>
      </div>

      {divider && <Divider type="horizontal" />}
    </>
  );
};

export default FormItem;
