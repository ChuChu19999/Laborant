import { useEffect, useState } from 'react';
import { useUpdateBranch, type Branch, type BranchFormValues } from '@/entities/Branch';
import { extractAxiosFieldError, extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';

const EMPTY_FORM: BranchFormValues = { name: '', phone: '' };
const NAME_REQUIRED = 'Название филиала обязательно';

export type UseEditBranchModalParams = {
  open: boolean;
  branch: Branch | null;
  onClose: () => void;
  onSuccess?: () => void;
};

/** Оркестрация модалки редактирования филиала. */
export const useEditBranchModal = ({
  open,
  branch,
  onClose,
  onSuccess,
}: UseEditBranchModalParams) => {
  const updateBranchMutation = useUpdateBranch();
  const [formData, setFormData] = useState<BranchFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (branch && open) {
      setFormData({
        name: branch.name || '',
        phone: branch.phone || '',
      });
      setErrors({});
    }
  }, [branch, open]);

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
    if (!branch?.id || !validate()) {
      return;
    }

    try {
      setLoading(true);
      const updateData: { name?: string; phone?: string } = {};
      if (formData.name.trim() !== branch.name) {
        updateData.name = formData.name.trim();
      }
      if (formData.phone.trim() !== (branch.phone || '')) {
        updateData.phone = formData.phone.trim() || undefined;
      }

      if (Object.keys(updateData).length > 0) {
        await updateBranchMutation.mutateAsync({ id: branch.id, data: updateData });
      }

      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      const nameError = extractAxiosFieldError(error, 'name');
      if (nameError) {
        setErrors({ name: nameError });
        return;
      }
      notify.error(extractErrorMessage(error, 'Не удалось обновить филиал'));
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
