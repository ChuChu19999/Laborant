import React, { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import { VisibilityScopeForm } from '../../../../entities/VisibilityScopeForm';
import { ROLE_TYPE_OPTIONS } from '../../../../shared/lib/roleTypeOptions';
import { useCreateRole } from '../../../../shared/model/hooks';
import { Input, Select } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import type { RoleCreate } from '../../../../shared/api/roles';
import type { VisibilityScope } from '../../../../shared/api/testObjects';
import type { RoleTypeValue } from '../../../../shared/lib/roleTypeOptions';
import './CreateRoleModal.css';

const EMPTY_VISIBILITY_SCOPE: VisibilityScope = {
  laboratory_ids: [],
  department_ids: [],
};

interface CreateRoleModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateRoleModal: React.FC<CreateRoleModalProps> = ({ open, onClose, onSuccess }) => {
  const createMutation = useCreateRole();
  const [name, setName] = useState('');
  const [roleType, setRoleType] = useState<RoleTypeValue | undefined>(undefined);
  const [visibilityScope, setVisibilityScope] = useState<VisibilityScope>(EMPTY_VISIBILITY_SCOPE);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      setName('');
      setRoleType(undefined);
      setVisibilityScope(EMPTY_VISIBILITY_SCOPE);
      setErrors({});
    }
  }, [open]);

  const handleNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setName(event.target.value);
      if (errors.name) {
        setErrors(prev => ({ ...prev, name: false }));
      }
    },
    [errors]
  );

  const handleRoleTypeChange = useCallback(
    (value: unknown) => {
      setRoleType(value as RoleTypeValue);
      if (errors.role_type) {
        setErrors(prev => ({ ...prev, role_type: false }));
      }
    },
    [errors]
  );

  const validateForm = useCallback(() => {
    const newErrors: Record<string, boolean> = {};

    if (!name.trim()) {
      newErrors.name = true;
    }

    if (!roleType) {
      newErrors.role_type = true;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      message.error('Пожалуйста, заполните все обязательные поля');
      return false;
    }

    setErrors({});
    return true;
  }, [name, roleType]);

  const handleSave = useCallback(async () => {
    if (!validateForm() || !roleType) {
      return;
    }

    const payload: RoleCreate = {
      name: name.trim(),
      role_type: roleType,
      visibility_scope: {
        laboratory_ids: visibilityScope.laboratory_ids,
        department_ids: visibilityScope.department_ids,
      },
    };

    await createMutation.mutateAsync(payload);
    onSuccess();
  }, [name, roleType, visibilityScope, createMutation, onSuccess, validateForm]);

  const handleCancel = useCallback(() => {
    setName('');
    setRoleType(undefined);
    setVisibilityScope(EMPTY_VISIBILITY_SCOPE);
    setErrors({});
    onClose();
  }, [onClose]);

  if (!open) {
    return null;
  }

  return (
    <Modal
      header="Добавление области видимости роли"
      onClose={onClose}
      onCancel={handleCancel}
      onSave={handleSave}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="550"
    >
      <div className="role-form">
        <div className="form-group">
          <label>
            Роль <span className="required">*</span>
          </label>
          <Input
            value={name}
            onChange={handleNameChange}
            placeholder="Введите наименование роли"
            status={errors.name ? 'error' : ''}
          />
        </div>

        <div className="form-group">
          <label>
            Тип роли <span className="required">*</span>
          </label>
          <Select
            value={roleType}
            onChange={handleRoleTypeChange}
            placeholder="Выберите тип роли"
            options={ROLE_TYPE_OPTIONS}
            status={errors.role_type ? 'error' : ''}
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

export default CreateRoleModal;
