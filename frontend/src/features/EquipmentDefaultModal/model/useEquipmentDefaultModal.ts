import { useEffect, useRef, useState } from 'react';
import { useEquipmentForScope } from '@/entities/Equipment';
import { useUpdateResearchMethod } from '@/entities/ResearchMethod';
import { notify } from '@/shared/lib/notify';
import type { ResearchMethod } from '@/entities/ResearchMethod';

export type UseEquipmentDefaultModalParams = {
  open: boolean;
  onClose: () => void;
  currentMethod?: ResearchMethod;
  laboratoryId?: number;
  departmentId?: number;
};

/** Оркестрация модалки приборов по умолчанию; one-shot hydrate при open+method id. */
export const useEquipmentDefaultModal = ({
  open,
  onClose,
  currentMethod,
  laboratoryId,
  departmentId,
}: UseEquipmentDefaultModalParams) => {
  const [selectedEquipment, setSelectedEquipment] = useState<number[]>([]);
  const hydrateKeyRef = useRef<string | null>(null);

  const updateMethodMutation = useUpdateResearchMethod();

  const { data: equipmentData, isLoading: loadingEquipment } = useEquipmentForScope(
    laboratoryId,
    departmentId,
    open && !!laboratoryId
  );

  const equipment = equipmentData?.items.filter(eq => !eq.deleted_at) || [];

  useEffect(() => {
    if (!open || !currentMethod) {
      if (!open) {
        hydrateKeyRef.current = null;
      }
      return;
    }

    const key = String(currentMethod.id);
    if (hydrateKeyRef.current === key) {
      return;
    }
    hydrateKeyRef.current = key;
    setSelectedEquipment(currentMethod.equipment_data_default || []);
  }, [open, currentMethod]);

  const handleSave = async () => {
    if (!currentMethod) {
      return;
    }

    try {
      await updateMethodMutation.mutateAsync({
        id: currentMethod.id,
        data: {
          equipment_data_default: selectedEquipment,
        },
      });
      onClose();
    } catch {
      notify.error('Не удалось сохранить оборудование по умолчанию');
    }
  };

  const handleModalClose = () => {
    if (currentMethod) {
      setSelectedEquipment(currentMethod.equipment_data_default || []);
    }
    onClose();
  };

  return {
    selectedEquipment,
    setSelectedEquipment,
    equipment,
    loadingEquipment,
    handleSave,
    handleModalClose,
  };
};
