import { useEffect, useState } from 'react';
import { useCreateLaboratory, type LaboratoryFormValues } from '@/entities/Laboratory';
import { extractAxiosFieldError, extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';

const EMPTY_FORM: LaboratoryFormValues = {
  name: '',
  full_name: '',
  laboratory_location: '',
};
const NAME_REQUIRED = 'Аббревиатура обязательна для заполнения';
const FULL_NAME_REQUIRED = 'Полное название обязательно для заполнения';

export type UseCreateLaboratoryModalParams = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

/** Оркестрация модалки создания лаборатории. */
export const useCreateLaboratoryModal = ({
  open,
  onClose,
  onSuccess,
}: UseCreateLaboratoryModalParams) => {
  const createLaboratoryMutation = useCreateLaboratory();
  const [formData, setFormData] = useState<LaboratoryFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(EMPTY_FORM);
      setErrors({});
    }
  }, [open]);

  const handleFieldChange = (field: keyof LaboratoryFormValues, value: string) => {
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
    if (!formData.full_name.trim()) {
      newErrors.full_name = FULL_NAME_REQUIRED;
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
      await createLaboratoryMutation.mutateAsync({
        name: formData.name.trim(),
        full_name: formData.full_name.trim(),
        laboratory_location: formData.laboratory_location.trim() || undefined,
      });
      setFormData(EMPTY_FORM);
      setErrors({});
      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      const nameError = extractAxiosFieldError(error, 'name');
      if (nameError) {
        setErrors({ name: nameError });
        return;
      }
      notify.error(extractErrorMessage(error, 'Не удалось добавить лабораторию'));
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
