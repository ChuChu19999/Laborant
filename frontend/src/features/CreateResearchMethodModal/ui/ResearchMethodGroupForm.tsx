import { Checkbox } from '@/shared/ui/Checkbox';
import { FormField } from '@/shared/ui/FormField';
import { Input } from '@/shared/ui/FormItems';
import { Spin, type SpinProps } from '@/shared/ui/Spin';

type ResearchMethodGroupFormProps = {
  groupData: {
    name: string;
    selectedMethods: number[];
  };
  availableMethods: {
    individual_methods: { id: number; name: string }[];
    groups: { id: number; name: string }[];
  };
  isLoadingMethods: boolean;
  spinnerIndicator: SpinProps['indicator'];
  onGroupDataChange: (field: string, value: unknown) => void;
  onNameChange: (name: string) => void;
};

export const ResearchMethodGroupForm = ({
  groupData,
  availableMethods,
  isLoadingMethods,
  spinnerIndicator,
  onGroupDataChange,
  onNameChange,
}: ResearchMethodGroupFormProps) => (
  <>
    <FormField
      label="Название группы"
      itemClassName="create-research-method-form-group"
      fieldId="research-method-group-name"
    >
      {fieldId => (
        <Input
          id={fieldId}
          value={groupData.name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Введите название группы"
        />
      )}
    </FormField>

    <FormField
      label="Выберите методы для группы"
      labelMode="group"
      itemClassName="create-research-method-form-group"
      fieldId="research-method-group-methods"
    >
      {(_fieldId, labelId) => (
        <div aria-labelledby={labelId}>
          {isLoadingMethods ? (
            <div className="create-research-method-modal-spinner">
              <Spin tip="Загрузка методов..." indicator={spinnerIndicator} spinning>
                <div className="create-research-method-modal-spinner-placeholder" />
              </Spin>
            </div>
          ) : (
            <div className="methods-list">
              {availableMethods.individual_methods.map(method => (
                <Checkbox
                  key={method.id}
                  checked={groupData.selectedMethods.includes(method.id)}
                  onChange={e => {
                    const newSelectedMethods = e.target.checked
                      ? [...groupData.selectedMethods, method.id]
                      : groupData.selectedMethods.filter(id => id !== method.id);
                    onGroupDataChange('selectedMethods', newSelectedMethods);
                  }}
                >
                  {method.name}
                </Checkbox>
              ))}
            </div>
          )}
        </div>
      )}
    </FormField>
  </>
);
