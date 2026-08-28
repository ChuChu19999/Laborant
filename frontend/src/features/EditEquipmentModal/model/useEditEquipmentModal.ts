import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import {
  buildEquipmentMethodOptions,
  useUpdateEquipment,
  type Equipment,
  type EquipmentFormValues,
  type EquipmentUpdate,
} from '@/entities/Equipment';
import { useResearchMethodsForEquipment } from '@/entities/ResearchMethod';
import { extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';

dayjs.locale('ru');

const EMPTY_FORM: EquipmentFormValues = {
  type: undefined,
  name: '',
  serial_number: '',
  verification_info: '',
  verification_date: null,
  verification_end_date: null,
  method_ids: [],
};

const REQUIRED_FIELDS_MESSAGE = 'Пожалуйста, заполните все обязательные поля';

export type UseEditEquipmentModalParams = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  equipment: Equipment;
  laboratoryId?: number;
  departmentId?: number;
};

/** Оркестрация модалки редактирования прибора. */
export const useEditEquipmentModal = ({
  open,
  onClose,
  onSuccess,
  equipment,
  laboratoryId,
  departmentId,
}: UseEditEquipmentModalParams) => {
  const updateEquipmentMutation = useUpdateEquipment();
  const [formData, setFormData] = useState<EquipmentFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof EquipmentFormValues, boolean>>>({});

  const { methodsData, groupsData, isLoadingMethods } = useResearchMethodsForEquipment(
    laboratoryId,
    departmentId,
    open && !!laboratoryId
  );

  const methods = useMemo(
    () => buildEquipmentMethodOptions(methodsData?.items, groupsData?.items),
    [methodsData, groupsData]
  );

  useEffect(() => {
    if (open && equipment) {
      setFormData({
        type: equipment.type || undefined,
        name: equipment.name || '',
        serial_number: equipment.serial_number || '',
        verification_info: equipment.verification_info || '',
        verification_date: equipment.verification_date ? dayjs(equipment.verification_date) : null,
        verification_end_date: equipment.verification_end_date
          ? dayjs(equipment.verification_end_date)
          : null,
        method_ids: equipment.method_data_default || [],
      });
      setErrors({});
    }
  }, [open, equipment]);

  const handleFieldChange = <K extends keyof EquipmentFormValues>(
    field: K,
    value: EquipmentFormValues[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: false }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof EquipmentFormValues, boolean>> = {};
    if (!formData.type) {
      newErrors.type = true;
    }
    if (!formData.name.trim()) {
      newErrors.name = true;
    }
    if (!formData.serial_number.trim()) {
      newErrors.serial_number = true;
    }
    if (!formData.verification_info.trim()) {
      newErrors.verification_info = true;
    }
    if (!formData.verification_date) {
      newErrors.verification_date = true;
    }
    if (!formData.verification_end_date) {
      newErrors.verification_end_date = true;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      notify.error(REQUIRED_FIELDS_MESSAGE);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    const verificationDate = formData.verification_date;
    const verificationEndDate = formData.verification_end_date;
    if (verificationDate == null || verificationEndDate == null) {
      return;
    }

    const equipmentData: EquipmentUpdate = {
      type: formData.type,
      name: formData.name,
      serial_number: formData.serial_number,
      verification_info: formData.verification_info,
      verification_date: verificationDate.format('YYYY-MM-DD'),
      verification_end_date: verificationEndDate.format('YYYY-MM-DD'),
      laboratory_id: laboratoryId,
      department_id: departmentId,
      method_data_default: formData.method_ids,
    };

    try {
      await updateEquipmentMutation.mutateAsync({ id: equipment.id, data: equipmentData });
      onSuccess();
    } catch (error: unknown) {
      notify.error(extractErrorMessage(error, 'Не удалось обновить прибор'));
    }
  };

  const handleCancel = () => {
    if (equipment) {
      setFormData({
        type: equipment.type || undefined,
        name: equipment.name || '',
        serial_number: equipment.serial_number || '',
        verification_info: equipment.verification_info || '',
        verification_date: equipment.verification_date ? dayjs(equipment.verification_date) : null,
        verification_end_date: equipment.verification_end_date
          ? dayjs(equipment.verification_end_date)
          : null,
        method_ids: equipment.method_data_default || [],
      });
    }
    setErrors({});
    onClose();
  };

  return {
    formData,
    errors,
    methods,
    isLoadingMethods,
    handleFieldChange,
    handleSave,
    handleCancel,
  };
};
