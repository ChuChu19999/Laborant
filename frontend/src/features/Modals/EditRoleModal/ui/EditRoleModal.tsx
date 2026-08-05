import React, { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import { VisibilityScopeForm } from '../../../../entities/VisibilityScopeForm';
import { ROLE_TYPE_OPTIONS } from '../../../../shared/lib/roleTypeOptions';
import { useUpdateRole } from '../../../../shared/model/hooks';
import { Input, Select } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import type { RoleCatalogItem } from '../../../../shared/api/roles';
import type { VisibilityScope } from '../../../../shared/api/testObjects';
import type { RoleTypeValue } from '../../../../shared/lib/roleTypeOptions';
import '../../CreateRoleModal/ui/CreateRoleModal.css';

interface EditRoleModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  role: RoleCatalogItem | null;
}

const EditRoleModal: React.FC<EditRoleModalProps> = ({ open, onClose, onSuccess, role }) => {
  const updateMutation = useUpdateRole();
  const [name, setName] = useState('');
  const [roleType, setRoleType] = useState<RoleTypeValue | undefined>(undefined);
  const [visibilityScope, setVisibilityScope] = useState<VisibilityScope>({
    laboratory_ids: [],
    department_ids: [],
  });
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open || !role) {
      return;
    }

    setName(role.name);
    setRoleType(role.role_type);
    setVisibilityScope({
      laboratory_ids: role.visibility_scope.laboratory_ids || [],
      department_ids: role.visibility_scope.department_ids || [],
    });
    setErrors({});
  }, [open, role]);

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
    if (!role || !validateForm() || !roleType) {
      return;
    }

    await updateMutation.mutateAsync({
      id: role.id,
      data: {
        name: name.trim(),
        role_type: roleType,
        visibility_scope: {
          laboratory_ids: visibilityScope.laboratory_ids,
          department_ids: visibilityScope.department_ids,
        },
      },
    });
    onSuccess();
  }, [role, name, roleType, visibilityScope, updateMutation, onSuccess, validateForm]);

  const handleCancel = useCallback(() => {
    if (role) {
      setName(role.name);
      setRoleType(role.role_type);
      setVisibilityScope({
        laboratory_ids: role.visibility_scope.laboratory_ids || [],
        department_ids: role.visibility_scope.department_ids || [],
      });
    }
    setErrors({});
    onClose();
  }, [onClose, role]);

  if (!open || !role) {
    return null;
  }

  return (
    <Modal
      header="Редактирование роли"
      onClose={handleCancel}
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

export default EditRoleModal;
