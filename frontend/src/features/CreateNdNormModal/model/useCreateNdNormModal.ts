import { useEffect, useState } from 'react';
import { useCreateNdNorm, type NdNormCreate, type NdNormFormValues } from '@/entities/NdNorm';
import { useTestObjectNames } from '@/entities/TestObject';
import { notify } from '@/shared/lib/notify';
import type { ResearchMethodDisplayItem } from '@/entities/ResearchMethod';

const EMPTY_FORM: NdNormFormValues = {
  name: '',
  test_object: undefined,
  methodTexts: {},
};

export type UseCreateNdNormModalParams = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  laboratoryId?: number;
  departmentId?: number;
  methods: ResearchMethodDisplayItem[];
};

/** Оркестрация модалки создания нормы НД. */
export const useCreateNdNormModal = ({
  open,
  onClose,
  onSuccess,
  laboratoryId,
  departmentId,
  methods,
}: UseCreateNdNormModalParams) => {
  const createNdNormMutation = useCreateNdNorm();
  const [errors, setErrors] = useState<Partial<Record<'name' | 'test_object', boolean>>>({});
  const [formData, setFormData] = useState<NdNormFormValues>(EMPTY_FORM);

  const { data: testObjectOptions = [] } = useTestObjectNames(
    laboratoryId,
    departmentId,
    open && !!laboratoryId
  );

  useEffect(() => {
    if (!open) {
      setFormData(EMPTY_FORM);
      setErrors({});
    }
  }, [open]);

  const handleChange = (patch: Partial<NdNormFormValues>) => {
    setFormData(prev => ({ ...prev, ...patch }));
    setErrors(prev => {
      const next = { ...prev };
      if (patch.name !== undefined) {
        next.name = false;
      }
      if (patch.test_object !== undefined) {
        next.test_object = false;
      }
      return next;
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<'name' | 'test_object', boolean>> = {};

    if (!formData.name.trim()) {
      newErrors.name = true;
    }
    if (!formData.test_object) {
      newErrors.test_object = true;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (newErrors.name) {
        notify.error('Пожалуйста, заполните наименование нормы');
      } else if (newErrors.test_object) {
        notify.error('Пожалуйста, выберите объект испытаний');
      }
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    if (!laboratoryId) {
      notify.error('Лаборатория не выбрана');
      return;
    }

    const testObject = formData.test_object;
    if (testObject == null) {
      return;
    }

    const ndNormData: NdNormCreate = {
      name: formData.name.trim(),
      test_object: testObject,
      laboratory_id: laboratoryId,
      department_id: departmentId,
      method_data: methods.map(method => ({
        method_id: method.id,
        value: (formData.methodTexts[method.id] || '').trim(),
      })),
    };

    await createNdNormMutation.mutateAsync(ndNormData);
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
    testObjectOptions,
    handleChange,
    handleSave,
    handleCancel,
  };
};
