import { useEffect, useState } from 'react';
import { useCreateDepartment, type DepartmentFormValues } from '@/entities/Department';
import { extractAxiosFieldError, extractErrorMessage } from '@/shared/lib/errors';

const EMPTY_FORM: DepartmentFormValues = { name: '', laboratory_location: '' };
const NAME_REQUIRED = 'Название подразделения обязательно';
const LOCATION_REQUIRED = 'Место осуществления лабораторной деятельности обязательно';

export type UseCreateDepartmentModalParams = {
  open: boolean;
  laboratoryId: number;
  onClose: () => void;
  onSuccess?: () => void;
};

/** Оркестрация модалки создания подразделения. */
export const useCreateDepartmentModal = ({
  open,
  laboratoryId,
  onClose,
  onSuccess,
}: UseCreateDepartmentModalParams) => {
  const createDepartmentMutation = useCreateDepartment();
  const [formData, setFormData] = useState<DepartmentFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(EMPTY_FORM);
      setErrors({});
    }
  }, [open]);

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
    if (!validate()) {
      return;
    }

    try {
      setLoading(true);
      await createDepartmentMutation.mutateAsync({
        name: formData.name.trim(),
        laboratory_id: laboratoryId,
        laboratory_location: formData.laboratory_location.trim(),
      });
      setFormData(EMPTY_FORM);
      setErrors({});
      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      const nameError = extractAxiosFieldError(error, 'name');
      if (nameError) {
        setErrors(
          nameError.includes('уже существует') ? { name: nameError } : { general: nameError }
        );
        return;
      }
      setErrors({
        general: extractErrorMessage(error, 'Не удалось добавить подразделение'),
      });
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
