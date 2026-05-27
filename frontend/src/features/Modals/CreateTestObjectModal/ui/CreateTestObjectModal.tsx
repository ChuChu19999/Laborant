import React, { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import { VisibilityScopeForm } from '../../../../entities/VisibilityScopeForm';
import { useCreateTestObject } from '../../../../shared/model/hooks';
import { Input } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import type { TestObjectCreate, VisibilityScope } from '../../../../shared/api/testObjects';
import './CreateTestObjectModal.css';

const EMPTY_VISIBILITY_SCOPE: VisibilityScope = {
  laboratory_ids: [],
  department_ids: [],
};

interface CreateTestObjectModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateTestObjectModal: React.FC<CreateTestObjectModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const createMutation = useCreateTestObject();
  const [formData, setFormData] = useState({
    name: '',
    tag: '',
  });
  const [visibilityScope, setVisibilityScope] = useState<VisibilityScope>(EMPTY_VISIBILITY_SCOPE);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      setFormData({ name: '', tag: '' });
      setVisibilityScope(EMPTY_VISIBILITY_SCOPE);
      setErrors({});
    }
  }, [open]);

  const handleInputChange = useCallback(
    (field: 'name' | 'tag') => (event: React.ChangeEvent<HTMLInputElement>) => {
      setFormData(prev => ({
        ...prev,
        [field]: event.target.value,
      }));
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: false }));
      }
    },
    [errors]
  );

  const validateForm = useCallback(() => {
    const newErrors: Record<string, boolean> = {};
    if (!formData.name.trim()) {
      newErrors.name = true;
    }
    if (!formData.tag.trim()) {
      newErrors.tag = true;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      message.error('Пожалуйста, заполните все обязательные поля');
      return false;
    }

    setErrors({});
    return true;
  }, [formData]);

  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    const payload: TestObjectCreate = {
      name: formData.name.trim(),
      tag: formData.tag.trim(),
      visibility_scope: {
        laboratory_ids: visibilityScope.laboratory_ids,
        department_ids: visibilityScope.department_ids,
      },
    };

    await createMutation.mutateAsync(payload);
    onSuccess();
  }, [formData, visibilityScope, createMutation, onSuccess, validateForm]);

  const handleCancel = useCallback(() => {
    setFormData({ name: '', tag: '' });
    setVisibilityScope(EMPTY_VISIBILITY_SCOPE);
    setErrors({});
    onClose();
  }, [onClose]);

  if (!open) {
    return null;
  }

  return (
    <Modal
      header="Добавление объекта испытаний"
      onClose={onClose}
      onCancel={handleCancel}
      onSave={handleSave}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="550"
    >
      <div className="test-object-form">
        <div className="form-group">
          <label>
            Наименование <span className="required">*</span>
          </label>
          <Input
            value={formData.name}
            onChange={handleInputChange('name')}
            placeholder="Введите наименование"
            status={errors.name ? 'error' : ''}
          />
        </div>

        <div className="form-group">
          <label>
            Тег <span className="required">*</span>
          </label>
          <Input
            value={formData.tag}
            onChange={handleInputChange('tag')}
            placeholder="Например: oil, condensate, oil_calibration"
            status={errors.tag ? 'error' : ''}
          />
        </div>

        <div className="form-group">
          <label>Область видимости</label>
          <VisibilityScopeForm value={visibilityScope} onChange={setVisibilityScope} />
        </div>
      </div>
    </Modal>
  );
};

export default CreateTestObjectModal;
