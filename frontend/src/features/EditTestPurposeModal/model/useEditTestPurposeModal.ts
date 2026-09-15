import { useEffect, useState } from 'react';
import {
  useUpdateTestPurpose,
  type TestPurpose,
  type TestPurposeFormValues,
} from '@/entities/TestPurpose';
import { extractAxiosFieldError, extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';

const EMPTY_FORM: TestPurposeFormValues = { name: '' };
const NAME_REQUIRED = 'Название цели испытаний обязательно';

export type UseEditTestPurposeModalParams = {
  open: boolean;
  testPurpose: TestPurpose | null;
  onClose: () => void;
  onSuccess?: () => void;
};

/** Оркестрация модалки редактирования цели испытаний. */
export const useEditTestPurposeModal = ({
  open,
  testPurpose,
  onClose,
  onSuccess,
}: UseEditTestPurposeModalParams) => {
  const updateTestPurposeMutation = useUpdateTestPurpose();
  const [formData, setFormData] = useState<TestPurposeFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (testPurpose && open) {
      setFormData({ name: testPurpose.name || '' });
      setErrors({});
    }
  }, [testPurpose, open]);

  const handleFieldChange = (field: keyof TestPurposeFormValues, value: string) => {
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
    if (!testPurpose?.id || !validate()) {
      return;
    }

    try {
      setLoading(true);
      const updateData: { name?: string } = {};
      if (formData.name.trim() !== testPurpose.name) {
        updateData.name = formData.name.trim();
      }

      if (Object.keys(updateData).length > 0) {
        await updateTestPurposeMutation.mutateAsync({ id: testPurpose.id, data: updateData });
      }

      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      const nameError = extractAxiosFieldError(error, 'name');
      if (nameError) {
        setErrors({ name: nameError });
        return;
      }
      notify.error(extractErrorMessage(error, 'Не удалось обновить цель испытаний'));
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
