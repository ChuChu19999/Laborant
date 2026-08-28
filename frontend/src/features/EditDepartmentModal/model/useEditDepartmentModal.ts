import { useEffect, useState } from 'react';
import {
  useUpdateDepartment,
  type Department,
  type DepartmentFormValues,
} from '@/entities/Department';
import { extractAxiosFieldError, extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';

const EMPTY_FORM: DepartmentFormValues = { name: '', laboratory_location: '' };
const NAME_REQUIRED = 'Название подразделения обязательно';
const LOCATION_REQUIRED = 'Место осуществления лабораторной деятельности обязательно';

export type UseEditDepartmentModalParams = {
  open: boolean;
  department: Department | null;
  onClose: () => void;
  onSuccess?: () => void;
};

/** Оркестрация модалки редактирования подразделения. */
export const useEditDepartmentModal = ({
  open,
  department,
  onClose,
  onSuccess,
}: UseEditDepartmentModalParams) => {
  const updateDepartmentMutation = useUpdateDepartment();
  const [formData, setFormData] = useState<DepartmentFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (department && open) {
      setFormData({
        name: department.name || '',
        laboratory_location: department.laboratory_location || '',
      });
      setErrors({});
    }
  }, [department, open]);

  const handleFieldChange = (field: keyof DepartmentFormValues, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = NAME_REQUIRED;
    }
    if (!formData.laboratory_location.trim()) {
      newErrors.laboratory_location = LOCATION_REQUIRED;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!department?.id || !validate()) {
      return;
    }

    try {
      setLoading(true);
      const updateData: {
        name?: string;
        laboratory_location?: string;
      } = {};

      if (formData.name.trim() !== department.name) {
        updateData.name = formData.name.trim();
      }
      if (formData.laboratory_location.trim() !== department.laboratory_location) {
        updateData.laboratory_location = formData.laboratory_location.trim();
      }

      if (Object.keys(updateData).length > 0) {
        await updateDepartmentMutation.mutateAsync({ id: department.id, data: updateData });
      }

      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      const nameError = extractAxiosFieldError(error, 'name');
      if (nameError) {
        setErrors({ name: nameError });
        return;
      }
      notify.error(extractErrorMessage(error, 'Не удалось обновить подразделение'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) {
      return;
    }
    setFormData(EMPTY_FORM);
    setErrors({});
    onClose();
  };

  return {
    formData,
    errors,
    handleFieldChange,
    handleSave,
    handleClose,
  };
};
