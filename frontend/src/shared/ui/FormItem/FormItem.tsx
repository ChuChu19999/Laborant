import React, { cloneElement, isValidElement, useId } from 'react';
import { BiInfoCircle } from 'react-icons/bi';
import { Divider } from '../Divider';
import { Form } from '../Form';
import { Tooltip } from '../Tooltip';
import './FormItem.css';

interface FormItemProps extends React.ComponentProps<typeof Form.Item> {
  title?: React.ReactNode;
  divider?: boolean;
  tooltip?: string;
  controlId?: string;
  children?: React.ReactNode;
}

const FormItem = ({
  title,
  divider,
  tooltip,
  children,
  controlId: controlIdProp,
  ...formItemProps
}: FormItemProps) => {
  const generatedId = useId();
  const controlId = controlIdProp ?? generatedId;
  const control = isValidElement(children)
    ? cloneElement(children as React.ReactElement<{ id?: string }>, { id: controlId })
    : children;

  return (
    <>
      <div className="form-item-container">
        {title ? (
          <label className="form-item-label" htmlFor={controlId}>
            {title}
            {tooltip ? (
              <Tooltip title={tooltip}>
                <BiInfoCircle size={16} />
              </Tooltip>
            ) : null}
          </label>
        ) : null}

        <Form.Item {...formItemProps} className="form-item-field">
          {control}
        </Form.Item>
      </div>

      {divider ? <Divider type="horizontal" /> : null}
    </>
  );
};

export default FormItem;
