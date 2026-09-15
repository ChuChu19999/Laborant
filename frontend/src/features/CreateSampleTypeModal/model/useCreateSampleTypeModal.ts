import { useEffect, useState } from 'react';
import { useCreateSampleType, type SampleTypeFormValues } from '@/entities/SampleType';
import { extractAxiosFieldError, extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';

const EMPTY_FORM: SampleTypeFormValues = { name: '' };
const NAME_REQUIRED = 'Название типа пробы обязательно';

export type UseCreateSampleTypeModalParams = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  laboratoryId?: number;
  departmentId?: number;
};

/** Оркестрация модалки создания типа пробы. */
export const useCreateSampleTypeModal = ({
  open,
  onClose,
  onSuccess,
  laboratoryId,
  departmentId,
}: UseCreateSampleTypeModalParams) => {
  const createSampleTypeMutation = useCreateSampleType();
  const [formData, setFormData] = useState<SampleTypeFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(EMPTY_FORM);
      setErrors({});
    }
  }, [open]);

  const handleFieldChange = (field: keyof SampleTypeFormValues, value: string) => {
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
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }
    if (!laboratoryId) {
      notify.error('Не выбрана лаборатория');
      return;
    }

    try {
      setLoading(true);
      await createSampleTypeMutation.mutateAsync({
        name: formData.name.trim(),
        laboratory_id: laboratoryId,
        department_id: departmentId ?? null,
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
      notify.error(extractErrorMessage(error, 'Не удалось добавить тип пробы'));
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
