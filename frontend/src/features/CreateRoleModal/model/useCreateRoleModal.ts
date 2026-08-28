import { useEffect, useState } from 'react';
import { useCreateRole, type RoleCreate, type RoleFormValues } from '@/entities/Role';
import { notify } from '@/shared/lib/notify';

const EMPTY_FORM: RoleFormValues = { name: '', role_type: undefined };
const REQUIRED_FIELDS_MESSAGE = 'Пожалуйста, заполните все обязательные поля';

export type UseCreateRoleModalParams = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

/** Оркестрация модалки создания роли. */
export const useCreateRoleModal = ({ open, onClose, onSuccess }: UseCreateRoleModalParams) => {
  const createMutation = useCreateRole();
  const [formData, setFormData] = useState<RoleFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof RoleFormValues, boolean>>>({});

  useEffect(() => {
    if (open) {
      setFormData(EMPTY_FORM);
      setErrors({});
    }
  }, [open]);

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
    if (!validateForm() || !formData.role_type) {
      return;
    }

    const payload: RoleCreate = {
      name: formData.name.trim(),
      role_type: formData.role_type,
      scopes: [],
    };

    await createMutation.mutateAsync(payload);
    onSuccess();
  };

  const handleCancel = () => {
    setFormData(EMPTY_FORM);
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
