import React, { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import { VisibilityScopeForm } from '../../../../entities/VisibilityScopeForm';
import { useUpdateTestObject } from '../../../../shared/model/hooks';
import { Input } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import type { TestObjectCatalogItem, VisibilityScope } from '../../../../shared/api/testObjects';
import '../../CreateTestObjectModal/ui/CreateTestObjectModal.css';

interface EditTestObjectModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  testObject: TestObjectCatalogItem | null;
}

const EditTestObjectModal: React.FC<EditTestObjectModalProps> = ({
  open,
  onClose,
  onSuccess,
  testObject,
}) => {
  const updateMutation = useUpdateTestObject();
  const [formData, setFormData] = useState({
    name: '',
    tag: '',
  });
  const [visibilityScope, setVisibilityScope] = useState<VisibilityScope>({
    laboratory_ids: [],
    department_ids: [],
  });
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open || !testObject) {
      return;
    }

    setFormData({
      name: testObject.name,
      tag: testObject.tag,
    });
    setVisibilityScope({
      laboratory_ids: testObject.visibility_scope.laboratory_ids || [],
      department_ids: testObject.visibility_scope.department_ids || [],
    });
    setErrors({});
  }, [open, testObject]);

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
    if (!testObject || !validateForm()) {
      return;
    }

    await updateMutation.mutateAsync({
      id: testObject.id,
      data: {
        name: formData.name.trim(),
        tag: formData.tag.trim(),
        visibility_scope: {
          laboratory_ids: visibilityScope.laboratory_ids,
          department_ids: visibilityScope.department_ids,
        },
      },
    });
    onSuccess();
  }, [testObject, formData, visibilityScope, updateMutation, onSuccess, validateForm]);

  const handleCancel = useCallback(() => {
    if (testObject) {
      setFormData({
        name: testObject.name,
        tag: testObject.tag,
      });
      setVisibilityScope({
        laboratory_ids: testObject.visibility_scope.laboratory_ids || [],
        department_ids: testObject.visibility_scope.department_ids || [],
      });
    }
    setErrors({});
    onClose();
  }, [onClose, testObject]);

  if (!open || !testObject) {
    return null;
  }

  return (
    <Modal
      header="Редактирование объекта испытаний"
      onClose={handleCancel}
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

export default EditTestObjectModal;
