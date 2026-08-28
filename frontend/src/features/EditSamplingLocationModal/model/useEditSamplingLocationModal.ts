import { useEffect, useState } from 'react';
import {
  useUpdateSamplingLocation,
  type SamplingLocation,
  type SamplingLocationFormValues,
} from '@/entities/SamplingLocation';
import { extractAxiosFieldError, extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';

const EMPTY_FORM: SamplingLocationFormValues = { name: '' };
const NAME_REQUIRED = 'Название места отбора пробы обязательно';

export type UseEditSamplingLocationModalParams = {
  open: boolean;
  location: SamplingLocation | null;
  onClose: () => void;
  onSuccess?: () => void;
};

/** Оркестрация модалки редактирования места отбора пробы. */
export const useEditSamplingLocationModal = ({
  open,
  location,
  onClose,
  onSuccess,
}: UseEditSamplingLocationModalParams) => {
  const updateSamplingLocationMutation = useUpdateSamplingLocation();
  const [formData, setFormData] = useState<SamplingLocationFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location && open) {
      setFormData({ name: location.name || '' });
      setErrors({});
    }
  }, [location, open]);

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
    if (!location?.id || !validate()) {
      return;
    }

    try {
      setLoading(true);
      const updateData: { name?: string } = {};
      if (formData.name.trim() !== location.name) {
        updateData.name = formData.name.trim();
      }

      if (Object.keys(updateData).length > 0) {
        await updateSamplingLocationMutation.mutateAsync({ id: location.id, data: updateData });
      }

      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      const nameError = extractAxiosFieldError(error, 'name');
      if (nameError) {
        setErrors({ name: nameError });
        return;
      }
      notify.error(extractErrorMessage(error, 'Не удалось обновить место отбора пробы'));
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
