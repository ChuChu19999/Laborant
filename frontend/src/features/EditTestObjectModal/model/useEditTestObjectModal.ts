import { useEffect, useState } from 'react';
import {
  useUpdateTestObject,
  type TestObjectCatalogItem,
  type TestObjectFormValues,
} from '@/entities/TestObject';
import { notify } from '@/shared/lib/notify';

const toFormValues = (testObject: TestObjectCatalogItem): TestObjectFormValues => ({
  name: testObject.name,
  tag: testObject.tag,
  protocol_abbreviation: testObject.protocol_abbreviation || '',
  visibility_scope: {
    laboratory_ids: testObject.visibility_scope.laboratory_ids || [],
    department_ids: testObject.visibility_scope.department_ids || [],
  },
});

export type UseEditTestObjectModalParams = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  testObject: TestObjectCatalogItem | null;
};

/** Оркестрация модалки редактирования объекта испытаний. */
export const useEditTestObjectModal = ({
  open,
  onClose,
  onSuccess,
  testObject,
}: UseEditTestObjectModalParams) => {
  const updateMutation = useUpdateTestObject();
  const [formData, setFormData] = useState<TestObjectFormValues>({
    name: '',
    tag: '',
    protocol_abbreviation: '',
    visibility_scope: { laboratory_ids: [], department_ids: [] },
  });
  const [errors, setErrors] = useState<Partial<Record<'name' | 'tag', boolean>>>({});

  useEffect(() => {
    if (!open || !testObject) {
      return;
    }
    setFormData(toFormValues(testObject));
    setErrors({});
  }, [open, testObject]);

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
    if (!testObject || !validateForm()) {
      return;
    }

    await updateMutation.mutateAsync({
      id: testObject.id,
      data: {
        name: formData.name.trim(),
        tag: formData.tag.trim(),
        protocol_abbreviation: formData.protocol_abbreviation.trim() || null,
        visibility_scope: {
          laboratory_ids: formData.visibility_scope.laboratory_ids,
          department_ids: formData.visibility_scope.department_ids,
        },
      },
    });
    onSuccess();
  };

  const handleCancel = () => {
    if (testObject) {
      setFormData(toFormValues(testObject));
    }
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
