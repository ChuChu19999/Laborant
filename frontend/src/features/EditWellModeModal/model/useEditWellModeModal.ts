import { useEffect, useState } from 'react';
import { useUpdateWellMode, type WellMode, type WellModeFormValues } from '@/entities/WellMode';
import { extractAxiosFieldError, extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';

const EMPTY_FORM: WellModeFormValues = { name: '' };
const NAME_REQUIRED = 'Название режима скважины обязательно';

export type UseEditWellModeModalParams = {
  open: boolean;
  wellMode: WellMode | null;
  onClose: () => void;
  onSuccess?: () => void;
};

/** Оркестрация модалки редактирования режима скважины. */
export const useEditWellModeModal = ({
  open,
  wellMode,
  onClose,
  onSuccess,
}: UseEditWellModeModalParams) => {
  const updateWellModeMutation = useUpdateWellMode();
  const [formData, setFormData] = useState<WellModeFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (wellMode && open) {
      setFormData({ name: wellMode.name || '' });
      setErrors({});
    }
  }, [wellMode, open]);

  const handleFieldChange = (field: keyof WellModeFormValues, value: string) => {
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
    if (!wellMode?.id || !validate()) {
      return;
    }

    try {
      setLoading(true);
      const updateData: { name?: string } = {};
      if (formData.name.trim() !== wellMode.name) {
        updateData.name = formData.name.trim();
      }

      if (Object.keys(updateData).length > 0) {
        await updateWellModeMutation.mutateAsync({ id: wellMode.id, data: updateData });
      }

      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      const nameError = extractAxiosFieldError(error, 'name');
      if (nameError) {
        setErrors({ name: nameError });
        return;
      }
      notify.error(extractErrorMessage(error, 'Не удалось обновить режим скважины'));
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
