import React, { useMemo } from 'react';
import { Typography } from 'antd';
import {
  buildVisibilityScopeOptions,
  selectValuesToVisibilityScope,
  visibilityScopeToSelectValues,
} from '../../../shared/lib/visibilityScopeOptions';
import { useLaboratoriesWithDepartments } from '../../../shared/model/hooks/useLaboratoriesWithDepartments';
import { Select } from '../../../shared/ui/FormItems';
import type { VisibilityScope } from '../../../shared/api/testObjects';
import './VisibilityScopeForm.css';

const { Text } = Typography;

interface VisibilityScopeFormProps {
  value: VisibilityScope;
  onChange: (value: VisibilityScope) => void;
}

const VisibilityScopeForm: React.FC<VisibilityScopeFormProps> = ({ value, onChange }) => {
  const { labsWithDepartments, isLoading } = useLaboratoriesWithDepartments(true);

  const options = useMemo(
    () => buildVisibilityScopeOptions(labsWithDepartments),
    [labsWithDepartments]
  );

  const selectedValues = useMemo(() => visibilityScopeToSelectValues(value), [value]);

  const handleChange = (rawValues: unknown) => {
    const values = Array.isArray(rawValues) ? (rawValues as string[]) : [];
    onChange(selectValuesToVisibilityScope(values));
  };

  return (
    <div className="visibility-scope-form">
      <Select
        mode="multiple"
        value={selectedValues}
        onChange={handleChange}
        placeholder="Выберите лаборатории или подразделения"
        loading={isLoading}
        disabled={isLoading}
        className="visibility-scope-form-select"
        listHeight={200}
        maxTagCount="responsive"
        allowClear
        optionFilterProp="label"
        showSearch
        filterOption={(input, option) =>
          String(option?.label ?? '')
            .toLowerCase()
            .includes(input.toLowerCase())
        }
        options={options.map(option => ({
          value: option.value,
          label: option.label,
        }))}
      />

      {!isLoading && options.length === 0 && (
        <Text type="secondary" className="visibility-scope-form-empty">
          Нет доступных лабораторий
        </Text>
      )}
    </div>
  );
};

export default VisibilityScopeForm;
