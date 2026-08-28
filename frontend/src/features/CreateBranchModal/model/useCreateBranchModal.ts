import { useEffect, useState } from 'react';
import { useCreateBranch, type BranchFormValues } from '@/entities/Branch';
import { extractAxiosFieldError, extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';

const EMPTY_FORM: BranchFormValues = { name: '', phone: '' };
const NAME_REQUIRED = 'Название филиала обязательно';

export type UseCreateBranchModalParams = {
  open: boolean;
  laboratoryId: number;
  departmentId?: number;
  onClose: () => void;
  onSuccess?: () => void;
};

/** Оркестрация модалки создания филиала. */
export const useCreateBranchModal = ({
  open,
  laboratoryId,
  departmentId,
  onClose,
  onSuccess,
}: UseCreateBranchModalParams) => {
  const createBranchMutation = useCreateBranch();
  const [formData, setFormData] = useState<BranchFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(EMPTY_FORM);
      setErrors({});
    }
  }, [open]);

  const handleFieldChange = (field: keyof BranchFormValues, value: string) => {
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
      await createBranchMutation.mutateAsync({
        name: formData.name.trim(),
        phone: formData.phone.trim() || undefined,
        laboratory_id: laboratoryId,
        department_id: departmentId,
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
      notify.error(extractErrorMessage(error, 'Не удалось добавить филиал'));
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
