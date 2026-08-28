import { useEffect, useState } from 'react';
import {
  useUpdateLaboratory,
  type Laboratory,
  type LaboratoryFormValues,
} from '@/entities/Laboratory';
import { extractAxiosFieldError, extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';

const EMPTY_FORM: LaboratoryFormValues = {
  name: '',
  full_name: '',
  laboratory_location: '',
};
const NAME_REQUIRED = 'Аббревиатура обязательна для заполнения';
const FULL_NAME_REQUIRED = 'Полное название обязательно для заполнения';

export type UseEditLaboratoryModalParams = {
  open: boolean;
  laboratory: Laboratory | null;
  onClose: () => void;
  onSuccess?: () => void;
};

/** Оркестрация модалки редактирования лаборатории. */
export const useEditLaboratoryModal = ({
  open,
  laboratory,
  onClose,
  onSuccess,
}: UseEditLaboratoryModalParams) => {
  const updateLaboratoryMutation = useUpdateLaboratory();
  const [formData, setFormData] = useState<LaboratoryFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (laboratory && open) {
      setFormData({
        name: laboratory.name || '',
        full_name: laboratory.full_name || '',
        laboratory_location: laboratory.laboratory_location || '',
      });
      setErrors({});
    }
  }, [laboratory, open]);

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
    if (!laboratory?.id || !validate()) {
      return;
    }

    try {
      setLoading(true);
      const updateData: {
        name?: string;
        full_name?: string;
        laboratory_location?: string;
      } = {};

      if (formData.name.trim() !== laboratory.name) {
        updateData.name = formData.name.trim();
      }
      if (formData.full_name.trim() !== laboratory.full_name) {
        updateData.full_name = formData.full_name.trim();
      }
      if (formData.laboratory_location.trim() !== (laboratory.laboratory_location || '')) {
        updateData.laboratory_location = formData.laboratory_location.trim();
      }

      if (Object.keys(updateData).length > 0) {
        await updateLaboratoryMutation.mutateAsync({ id: laboratory.id, data: updateData });
      }

      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      const nameError = extractAxiosFieldError(error, 'name');
      if (nameError) {
        setErrors({ name: nameError });
        return;
      }
      notify.error(extractErrorMessage(error, 'Не удалось обновить лабораторию'));
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
