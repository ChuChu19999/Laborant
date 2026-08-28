import { useId, type ReactNode } from 'react';

type FormFieldLabelMode = 'control' | 'group';

interface FormFieldProps {
  label: ReactNode;
  labelClassName?: string;
  itemClassName?: string;
  error?: ReactNode;
  fieldId?: string;
  /** control — htmlFor на focusable control; group — aria-labelledby для составного блока (upload и т.п.). */
  labelMode?: FormFieldLabelMode;
  children: (fieldId: string, labelId: string) => ReactNode;
}

/** Поле формы с связанным label (htmlFor или aria-labelledby). */
export function FormField({
  label,
  labelClassName,
  itemClassName,
  error,
  fieldId: fieldIdProp,
  labelMode = 'control',
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const fieldId = fieldIdProp ?? generatedId;
  const labelId = `${fieldId}-label`;

  return (
    <div className={itemClassName}>
      <label
        id={labelMode === 'group' ? labelId : undefined}
        className={labelClassName}
        htmlFor={labelMode === 'control' ? fieldId : undefined}
      >
        {label}
      </label>
      {children(fieldId, labelId)}
      {error}
    </div>
  );
}
