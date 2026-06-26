import React, { useCallback, useState, useEffect } from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import { message, Spin } from 'antd';
import { type NdNorm, type NdNormUpdate } from '../../../../shared/api/ndNorms';
import { samplesApi } from '../../../../shared/api/samples';
import { useUpdateNdNorm } from '../../../../shared/model/hooks';
import { type ResearchMethodDisplayItem } from '../../../../shared/model/hooks/useResearchMethodsForLab';
import { useAutoRefetchQuery } from '../../../../shared/model/lib/useQuery';
import { InputText, Select } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import './EditNdNormModal.css';

const { Option } = Select;

interface EditNdNormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  ndNorm: NdNorm;
  methods: ResearchMethodDisplayItem[];
  isLoadingMethods?: boolean;
}

const EditNdNormModal: React.FC<EditNdNormModalProps> = ({
  open,
  onClose,
  onSuccess,
  ndNorm,
  methods,
  isLoadingMethods = false,
}) => {
  const updateNdNormMutation = useUpdateNdNorm();
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [name, setName] = useState('');
  const [testObject, setTestObject] = useState<string | undefined>(undefined);
  const [methodTexts, setMethodTexts] = useState<Record<number, string>>({});
  const spinnerIndicator = <LoadingOutlined style={{ fontSize: 24, color: '#1677ff' }} spin />;

  const { data: testObjectOptions = [] } = useAutoRefetchQuery<string[]>(
    ['test-objects', ndNorm.laboratory_id, ndNorm.department_id],
    () => samplesApi.getTestObjects(ndNorm.laboratory_id, ndNorm.department_id),
    {
      enabled: open,
    }
  );

  useEffect(() => {
    if (open && ndNorm) {
      setName(ndNorm.name);
      setTestObject(ndNorm.test_object || undefined);
      const texts: Record<number, string> = {};
      ndNorm.method_data?.forEach(item => {
        texts[item.method_id] = item.text || '';
      });
      setMethodTexts(texts);
      setErrors({});
    }
  }, [open, ndNorm]);

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

    const updateData: NdNormUpdate = {
      name: name.trim(),
      test_object: testObject,
      method_data: methods.map(method => ({
        method_id: method.id,
        text: (methodTexts[method.id] || '').trim(),
      })),
    };

    await updateNdNormMutation.mutateAsync({ id: ndNorm.id, data: updateData });
    onSuccess();
  }, [
    validateForm,
    name,
    testObject,
    methods,
    methodTexts,
    updateNdNormMutation,
    ndNorm.id,
    onSuccess,
  ]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <Modal
      header="Редактирование нормы НД"
      onClose={onClose}
      onCancel={handleCancel}
      onSave={handleSave}
      saveButtonText="Сохранить"
      modalWidth="550"
    >
      <div className="edit-nd-norm-form">
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

export default EditNdNormModal;
