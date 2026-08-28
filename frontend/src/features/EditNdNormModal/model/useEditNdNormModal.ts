import { useEffect, useState } from 'react';
import {
  useUpdateNdNorm,
  type NdNorm,
  type NdNormFormValues,
  type NdNormUpdate,
} from '@/entities/NdNorm';
import { useTestObjectNames } from '@/entities/TestObject';
import { notify } from '@/shared/lib/notify';
import type { ResearchMethodDisplayItem } from '@/entities/ResearchMethod';

export type UseEditNdNormModalParams = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  ndNorm: NdNorm;
  methods: ResearchMethodDisplayItem[];
};

/** Оркестрация модалки редактирования нормы НД. */
export const useEditNdNormModal = ({
  open,
  onClose,
  onSuccess,
  ndNorm,
  methods,
}: UseEditNdNormModalParams) => {
  const updateNdNormMutation = useUpdateNdNorm();
  const [errors, setErrors] = useState<Partial<Record<'name' | 'test_object', boolean>>>({});
  const [formData, setFormData] = useState<NdNormFormValues>({
    name: '',
    test_object: undefined,
    methodTexts: {},
  });

  const { data: testObjectOptions = [] } = useTestObjectNames(
    ndNorm.laboratory_id,
    ndNorm.department_id,
    open
  );

  useEffect(() => {
    if (open && ndNorm) {
      const texts: Record<number, string> = {};
      ndNorm.method_data?.forEach(item => {
        texts[item.method_id] = item.value || '';
      });
      setFormData({
        name: ndNorm.name,
        test_object: ndNorm.test_object || undefined,
        methodTexts: texts,
      });
      setErrors({});
    }
  }, [open, ndNorm]);

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

    const updateData: NdNormUpdate = {
      name: formData.name.trim(),
      test_object: formData.test_object,
      method_data: methods.map(method => ({
        method_id: method.id,
        value: (formData.methodTexts[method.id] || '').trim(),
      })),
    };

    await updateNdNormMutation.mutateAsync({ id: ndNorm.id, data: updateData });
    onSuccess();
  };

  const handleCancel = () => {
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
