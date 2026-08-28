import { useEffect, useState } from 'react';
import {
  useCreateTestObject,
  type TestObjectCreate,
  type TestObjectFormValues,
} from '@/entities/TestObject';
import { notify } from '@/shared/lib/notify';

const EMPTY_FORM: TestObjectFormValues = {
  name: '',
  tag: '',
  protocol_abbreviation: '',
  visibility_scope: {
    laboratory_ids: [],
    department_ids: [],
  },
};

export type UseCreateTestObjectModalParams = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

/** Оркестрация модалки создания объекта испытаний. */
export const useCreateTestObjectModal = ({
  open,
  onClose,
  onSuccess,
}: UseCreateTestObjectModalParams) => {
  const createMutation = useCreateTestObject();
  const [formData, setFormData] = useState<TestObjectFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<'name' | 'tag', boolean>>>({});

  useEffect(() => {
    if (open) {
      setFormData(EMPTY_FORM);
      setErrors({});
    }
  }, [open]);

  const handleChange = (patch: Partial<TestObjectFormValues>) => {
    setFormData(prev => ({ ...prev, ...patch }));
    setErrors(prev => {
      const next = { ...prev };
      if (patch.name !== undefined) {
        next.name = false;
      }
      if (patch.tag !== undefined) {
        next.tag = false;
      }
      return next;
    });
  };

  const validateForm = () => {
    const newErrors: Partial<Record<'name' | 'tag', boolean>> = {};
    if (!formData.name.trim()) {
      newErrors.name = true;
    }
    if (!formData.tag.trim()) {
      newErrors.tag = true;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      notify.error('Пожалуйста, заполните все обязательные поля');
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    const payload: TestObjectCreate = {
      name: formData.name.trim(),
      tag: formData.tag.trim(),
      protocol_abbreviation: formData.protocol_abbreviation.trim() || null,
      visibility_scope: {
        laboratory_ids: formData.visibility_scope.laboratory_ids,
        department_ids: formData.visibility_scope.department_ids,
      },
    };

    await createMutation.mutateAsync(payload);
    onSuccess();
  };

  const handleCancel = () => {
    setFormData(EMPTY_FORM);
    setErrors({});
    onClose();
  };

  return {
    formData,
    errors,
    handleChange,
    handleSave,
    handleCancel,
  };
};
