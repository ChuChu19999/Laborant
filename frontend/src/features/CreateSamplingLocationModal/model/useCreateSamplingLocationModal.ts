import { useEffect, useState } from 'react';
import {
  useCreateSamplingLocation,
  type SamplingLocationFormValues,
} from '@/entities/SamplingLocation';
import { extractAxiosFieldError, extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';

const EMPTY_FORM: SamplingLocationFormValues = { name: '' };
const NAME_REQUIRED = 'Название места отбора пробы обязательно';

export type UseCreateSamplingLocationModalParams = {
  open: boolean;
  branchId: number;
  onClose: () => void;
  onSuccess?: () => void;
};

/** Оркестрация модалки создания места отбора пробы. */
export const useCreateSamplingLocationModal = ({
  open,
  branchId,
  onClose,
  onSuccess,
}: UseCreateSamplingLocationModalParams) => {
  const createSamplingLocationMutation = useCreateSamplingLocation();
  const [formData, setFormData] = useState<SamplingLocationFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(EMPTY_FORM);
      setErrors({});
    }
  }, [open]);

  const handleFieldChange = (field: keyof SamplingLocationFormValues, value: string) => {
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

    try {
      setLoading(true);
      await createSamplingLocationMutation.mutateAsync({
        name: formData.name.trim(),
        branch_id: branchId,
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
      notify.error(extractErrorMessage(error, 'Не удалось добавить место отбора пробы'));
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
