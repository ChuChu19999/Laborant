import { useEffect, useState } from 'react';
import { useUpdateRole, type RoleCatalogItem, type RoleFormValues } from '@/entities/Role';
import { notify } from '@/shared/lib/notify';

const EMPTY_FORM: RoleFormValues = { name: '', role_type: undefined };
const REQUIRED_FIELDS_MESSAGE = 'Пожалуйста, заполните все обязательные поля';

export type UseEditRoleModalParams = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  role: RoleCatalogItem | null;
};

/** Оркестрация модалки редактирования роли. */
export const useEditRoleModal = ({ open, onClose, onSuccess, role }: UseEditRoleModalParams) => {
  const updateMutation = useUpdateRole();
  const [formData, setFormData] = useState<RoleFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof RoleFormValues, boolean>>>({});

  useEffect(() => {
    if (!open || !role) {
      return;
    }
    setFormData({
      name: role.name,
      role_type: role.role_type,
    });
    setErrors({});
  }, [open, role]);

  const handleFieldChange = <K extends keyof RoleFormValues>(
    field: K,
    value: RoleFormValues[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: false }));
    }
  };

  const validateForm = () => {
    const newErrors: Partial<Record<keyof RoleFormValues, boolean>> = {};
    if (!formData.name.trim()) {
      newErrors.name = true;
    }
    if (!formData.role_type) {
      newErrors.role_type = true;
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      notify.error(REQUIRED_FIELDS_MESSAGE);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSave = async () => {
    if (!role || !validateForm() || !formData.role_type) {
      return;
    }

    await updateMutation.mutateAsync({
      id: role.id,
      data: {
        name: formData.name.trim(),
        role_type: formData.role_type,
      },
    });
    onSuccess();
  };

  const handleCancel = () => {
    if (role) {
      setFormData({
        name: role.name,
        role_type: role.role_type,
      });
    }
    setErrors({});
    onClose();
  };

  return {
    formData,
    errors,
    handleFieldChange,
    handleSave,
    handleCancel,
  };
};
