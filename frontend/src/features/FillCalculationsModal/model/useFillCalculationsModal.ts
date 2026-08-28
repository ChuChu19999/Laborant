import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type Calculation,
  useCalculationsBySample,
  useDeleteCalculation,
} from '@/entities/Calculation';
import { notify } from '@/shared/lib/notify';
import type { Sample } from '@/entities/Sample';

export type UseFillCalculationsModalParams = {
  open: boolean;
  onClose: () => void;
  sample: Sample;
};

const buildCalculationsPath = (
  labId: number,
  departmentId: number | undefined | null,
  sampleId: number,
  editCalculationId?: number
) => {
  const base =
    departmentId != null
      ? `/samples/laboratory/${labId}/department/${departmentId}/calculations`
      : `/samples/laboratory/${labId}/calculations`;
  const query = new URLSearchParams({ sampleId: String(sampleId) });
  if (editCalculationId != null) {
    query.set('editCalculationId', String(editCalculationId));
  }
  return `${base}?${query.toString()}`;
};

/** Оркестрация модалки списка расчётов пробы: загрузка, переход к созданию/редактированию, удаление. */
export const useFillCalculationsModal = ({
  open,
  onClose,
  sample,
}: UseFillCalculationsModalParams) => {
  const navigate = useNavigate();
  const deleteCalculationMutation = useDeleteCalculation();
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    calculationId: number | null;
  }>({
    isOpen: false,
    calculationId: null,
  });

  const { data: calculations, isLoading } = useCalculationsBySample(sample.id, open && !!sample.id);

  const handleCancel = () => {
    onClose();
  };

  const handleAddCalculation = () => {
    const labId = sample.laboratory_id;
    if (!labId) {
      notify.error('Не удалось определить лабораторию для расчёта');
      return;
    }
    void navigate(buildCalculationsPath(labId, sample.department_id ?? undefined, sample.id));
    onClose();
  };

  const handleEditCalculation = (calculation: Calculation) => {
    const labId = calculation.laboratory_id ?? sample.laboratory_id;
    if (!labId) {
      notify.error('Не удалось определить лабораторию для расчёта');
      return;
    }
    const deptId = calculation.department_id ?? sample.department_id ?? undefined;
    void navigate(buildCalculationsPath(labId, deptId, sample.id, calculation.id));
    onClose();
  };

  const handleDelete = (calculationId: number) => {
    setDeleteConfirmation({
      isOpen: true,
      calculationId,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation.calculationId) return;

    await deleteCalculationMutation.mutateAsync(deleteConfirmation.calculationId);
    setDeleteConfirmation({
      isOpen: false,
      calculationId: null,
    });
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmation({
      isOpen: false,
      calculationId: null,
    });
  };

  return {
    calculations,
    isLoading,
    deleteConfirmation,
    handleCancel,
    handleAddCalculation,
    handleEditCalculation,
    handleDelete,
    handleDeleteConfirm,
    handleDeleteCancel,
  };
};
