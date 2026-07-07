import React, { useCallback, useState, useEffect } from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import { message, Spin } from 'antd';
import { type NdNormCreate } from '../../../../shared/api/ndNorms';
import { samplesApi } from '../../../../shared/api/samples';
import { useCreateNdNorm } from '../../../../shared/model/hooks';
import { type ResearchMethodDisplayItem } from '../../../../shared/model/hooks/useResearchMethodsForLab';
import { useAutoRefetchQuery } from '../../../../shared/model/lib/useQuery';
import { InputText, Select } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import './CreateNdNormModal.css';

const { Option } = Select;

interface CreateNdNormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  laboratoryId?: number;
  departmentId?: number;
  methods: ResearchMethodDisplayItem[];
  isLoadingMethods?: boolean;
}

const CreateNdNormModal: React.FC<CreateNdNormModalProps> = ({
  open,
  onClose,
  onSuccess,
  laboratoryId,
  departmentId,
  methods,
  isLoadingMethods = false,
}) => {
  const createNdNormMutation = useCreateNdNorm();
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [name, setName] = useState('');
  const [testObject, setTestObject] = useState<string | undefined>(undefined);
  const [methodTexts, setMethodTexts] = useState<Record<number, string>>({});
  const spinnerIndicator = <LoadingOutlined style={{ fontSize: 24, color: '#1677ff' }} spin />;

  const { data: testObjectOptions = [] } = useAutoRefetchQuery<string[]>(
    ['test-objects', laboratoryId, departmentId],
    () => samplesApi.getTestObjects(laboratoryId, departmentId),
    {
      enabled: open && !!laboratoryId,
    }
  );

  useEffect(() => {
    if (!open) {
      setName('');
      setTestObject(undefined);
      setMethodTexts({});
      setErrors({});
    }
  }, [open]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setName(e.target.value);
      if (errors.name) {
        setErrors(prev => ({ ...prev, name: false }));
      }
    },
    [errors.name]
  );

  const handleMethodTextChange = useCallback((methodId: number, value: string) => {
    setMethodTexts(prev => ({
      ...prev,
      [methodId]: value,
    }));
  }, []);

  const handleTestObjectChange = useCallback(
    (value: unknown) => {
      setTestObject(value as string | undefined);
      if (errors.test_object) {
        setErrors(prev => ({ ...prev, test_object: false }));
      }
    },
    [errors.test_object]
  );

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, boolean> = {};

    if (!name.trim()) {
      newErrors.name = true;
    }
    if (!testObject) {
      newErrors.test_object = true;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (newErrors.name) {
        message.error('Пожалуйста, заполните наименование нормы');
      } else if (newErrors.test_object) {
        message.error('Пожалуйста, выберите объект испытаний');
      }
      return false;
    }

    setErrors({});
    return true;
  }, [name, testObject]);

  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    if (!laboratoryId) {
      message.error('Лаборатория не выбрана');
      return;
    }

    const ndNormData: NdNormCreate = {
      name: name.trim(),
      test_object: testObject!,
      laboratory_id: laboratoryId,
      department_id: departmentId,
      method_data: methods.map(method => ({
        method_id: method.id,
        value: (methodTexts[method.id] || '').trim(),
      })),
    };

    await createNdNormMutation.mutateAsync(ndNormData);
    onSuccess();
  }, [
    validateForm,
    laboratoryId,
    departmentId,
    name,
    testObject,
    methods,
    methodTexts,
    createNdNormMutation,
    onSuccess,
  ]);

  const handleCancel = useCallback(() => {
    setName('');
    setTestObject(undefined);
    setMethodTexts({});
    setErrors({});
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <Modal
      header="Добавление нормы НД"
      onClose={onClose}
      onCancel={handleCancel}
      onSave={handleSave}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="550"
    >
      <div className="create-nd-norm-form">
        <div className="form-group">
          <label>
            Наименование нормы <span className="required">*</span>
          </label>
          <InputText
            value={name}
            onChange={handleNameChange}
            placeholder="Введите наименование нормы"
            status={errors.name ? 'error' : ''}
            autoSize={{ minRows: 2, maxRows: 6 }}
          />
        </div>

        <div className="form-group">
          <label>
            Объект испытаний <span className="required">*</span>
          </label>
          <Select
            value={testObject}
            onChange={handleTestObjectChange}
            placeholder="Выберите объект испытаний"
            status={errors.test_object ? 'error' : ''}
            listHeight={100}
            allowClear
          >
            {testObjectOptions.map(option => (
              <Option key={option} value={option}>
                {option}
              </Option>
            ))}
          </Select>
        </div>

        <div className="form-group">
          {isLoadingMethods ? (
            <div className="nd-norm-form-loading">
              <Spin indicator={spinnerIndicator} tip="Загрузка методов..." />
            </div>
          ) : methods.length === 0 ? (
            <div className="nd-norm-form-empty">Методы исследования не найдены</div>
          ) : (
            <div className="methods-list">
              {methods.map(method => (
                <div key={method.id} className="method-field">
                  <label>{method.displayName}</label>
                  <InputText
                    value={methodTexts[method.id] || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      handleMethodTextChange(method.id, e.target.value)
                    }
                    placeholder="Введите норму"
                    autoSize={{ minRows: 2, maxRows: 6 }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CreateNdNormModal;
