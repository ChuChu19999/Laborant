import { useEffect, useState } from 'react';
import {
  useUpdateSampleType,
  type SampleType,
  type SampleTypeFormValues,
} from '@/entities/SampleType';
import { extractAxiosFieldError, extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';

const EMPTY_FORM: SampleTypeFormValues = { name: '' };
const NAME_REQUIRED = 'Название типа пробы обязательно';

export type UseEditSampleTypeModalParams = {
  open: boolean;
  sampleType: SampleType | null;
  onClose: () => void;
  onSuccess?: () => void;
};

/** Оркестрация модалки редактирования типа пробы. */
export const useEditSampleTypeModal = ({
  open,
  sampleType,
  onClose,
  onSuccess,
}: UseEditSampleTypeModalParams) => {
  const updateSampleTypeMutation = useUpdateSampleType();
  const [formData, setFormData] = useState<SampleTypeFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sampleType && open) {
      setFormData({ name: sampleType.name || '' });
      setErrors({});
    }
  }, [sampleType, open]);

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
    if (!sampleType?.id || !validate()) {
      return;
    }

    try {
      setLoading(true);
      const updateData: { name?: string } = {};
      if (formData.name.trim() !== sampleType.name) {
        updateData.name = formData.name.trim();
      }

      if (Object.keys(updateData).length > 0) {
        await updateSampleTypeMutation.mutateAsync({ id: sampleType.id, data: updateData });
      }

      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      const nameError = extractAxiosFieldError(error, 'name');
      if (nameError) {
        setErrors({ name: nameError });
        return;
      }
      notify.error(extractErrorMessage(error, 'Не удалось обновить тип пробы'));
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
