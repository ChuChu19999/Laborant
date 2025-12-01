import React from 'react';
import './FormItemWrapper.css';

interface FormItemWrapperProps {
  children?: React.ReactNode;
}

const FormItemWrapper = ({ children }: FormItemWrapperProps) => {
  return <div className="form-item-wrapper">{children}</div>;
};

export default FormItemWrapper;
