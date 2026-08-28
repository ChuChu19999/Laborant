import { useEffect, useMemo, useRef, useState } from 'react';
import { useCreateCalculation, useReplaceCalculation } from '@/entities/Calculation';
import { useEmployeeByHsnils, type Employee } from '@/entities/Employee';
import { useEquipmentForCalculation } from '@/entities/Equipment';
import { useLaboratory } from '@/entities/Laboratory';
import { useResearchMethod } from '@/entities/ResearchMethod';
import { useCan } from '@/entities/Role';
import { useSamplesForCalculation } from '@/entities/Sample';
import { notify } from '@/shared/lib/notify';
import type { Dayjs } from 'dayjs';

export type UseSaveCalculationModalParams = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  calculationData: {
    input_data: Record<string, unknown>;
    result: string;
    measurement_error?: string;
    unit?: string;
  };
  laboratoryActivityDate: Dayjs | null;
  sampleId?: number;
  laboratoryId: number;
  departmentId?: number;
  researchMethodId: number;
  researchMethodIncludeDeleted?: boolean;
  equipment_data?: number[];
  editingCalculationId?: number;
  existingEquipmentData?: number[];
  previousExecutorHash?: string | null;
};

/** Оркестрация модалки сохранения расчёта; one-shot hydrate черновиков при открытии. */
export const useSaveCalculationModal = ({
  open,
  onClose,
  onSuccess,
  calculationData,
  laboratoryActivityDate,
  sampleId,
  laboratoryId,
  departmentId,
  researchMethodId,
  researchMethodIncludeDeleted = false,
  equipment_data,
  editingCalculationId,
  existingEquipmentData,
  previousExecutorHash,
}: UseSaveCalculationModalParams) => {
  const createCalculationMutation = useCreateCalculation();
  const replaceCalculationMutation = useReplaceCalculation();
  const showEquipmentField = useCan('calculations', 'show_equipment', laboratoryId, departmentId);
  const [executor, setExecutor] = useState<Employee | null>(null);
  const [executorError, setExecutorError] = useState('');
  const [selectedSampleId, setSelectedSampleId] = useState<number | undefined>(sampleId);
  const [sampleError, setSampleError] = useState('');
  const [laboratoryName, setLaboratoryName] = useState<string>('');
  const [selectedEquipment, setSelectedEquipment] = useState<number[]>([]);
  const hydrateKeyRef = useRef<string | null>(null);
  const labHydrateKeyRef = useRef<number | null>(null);
  const executorHydrateKeyRef = useRef<string | null>(null);

  const { data: samplesData, isLoading: samplesLoading } = useSamplesForCalculation(
    laboratoryId,
    departmentId,
    open && !sampleId && !!laboratoryId
  );

  const { data: laboratory } = useLaboratory(laboratoryId, open && !!laboratoryId);

  const { data: researchMethod } = useResearchMethod(
    researchMethodId,
    open && !!researchMethodId,
    researchMethodIncludeDeleted
  );

  const { data: previousExecutor } = useEmployeeByHsnils(
    previousExecutorHash ?? undefined,
    false,
    open && !!previousExecutorHash?.trim()
  );

  const { data: equipmentData, isLoading: isLoadingEquipment } = useEquipmentForCalculation(
    laboratoryId,
    departmentId,
    open && showEquipmentField && !!laboratoryId
  );

  const availableEquipment = useMemo(() => {
    if (!equipmentData?.items || !researchMethod) {
      return { selectable: [], required: [] };
    }

    const allEquipment = equipmentData.items.filter(eq => !eq.deleted_at);
    const requiredEquipmentIds = researchMethod.equipment_data_default || [];
    const requiredEquipment = allEquipment.filter(eq => requiredEquipmentIds.includes(eq.id));

    const selectableEquipment = allEquipment.filter(
      eq =>
        eq.method_data_default?.includes(researchMethodId) && !requiredEquipmentIds.includes(eq.id)
    );

    return {
      selectable: selectableEquipment,
      required: requiredEquipment,
    };
  }, [equipmentData, researchMethod, researchMethodId]);

  const allSelectedEquipment = useMemo(() => {
    const requiredIds = availableEquipment.required.map(eq => eq.id);
    return [...selectedEquipment, ...requiredIds];
  }, [selectedEquipment, availableEquipment.required]);

  const samples = samplesData?.items ?? [];

  useEffect(() => {
    if (!open) {
      labHydrateKeyRef.current = null;
      return;
    }
    if (!laboratory?.full_name) {
      return;
    }
    if (labHydrateKeyRef.current === laboratory.id) {
      return;
    }
    labHydrateKeyRef.current = laboratory.id;
    setLaboratoryName(laboratory.full_name);
  }, [open, laboratory]);

  useEffect(() => {
    if (!open) {
      hydrateKeyRef.current = null;
      executorHydrateKeyRef.current = null;
      return;
    }

    if (editingCalculationId && !researchMethod) {
      return;
    }

    const hydrateKey = [
      editingCalculationId ?? 'new',
      sampleId ?? '',
      previousExecutorHash ?? '',
      researchMethod?.id ?? '',
    ].join(':');

    if (hydrateKeyRef.current === hydrateKey) {
      return;
    }
    hydrateKeyRef.current = hydrateKey;

    setSelectedSampleId(sampleId);
    setExecutorError('');
    setSampleError('');

    if (!previousExecutorHash) {
      setExecutor(null);
    }

    if (editingCalculationId && researchMethod) {
      const rawIds = existingEquipmentData ?? [];
      const requiredIds = researchMethod.equipment_data_default || [];
      setSelectedEquipment(rawIds.filter(id => !requiredIds.includes(id)));
    } else if (!editingCalculationId) {
      setSelectedEquipment([]);
    }
  }, [
    open,
    sampleId,
    researchMethod,
    editingCalculationId,
    previousExecutorHash,
    existingEquipmentData,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!previousExecutorHash || !previousExecutor) {
      return;
    }
    if (typeof previousExecutor !== 'object' || !('hsnils' in previousExecutor)) {
      return;
    }
    if (executorHydrateKeyRef.current === previousExecutorHash) {
      return;
    }
    executorHydrateKeyRef.current = previousExecutorHash;
    setExecutor(previousExecutor);
  }, [open, previousExecutorHash, previousExecutor]);

  const handleSampleChange = (value: number | undefined) => {
    setSelectedSampleId(value);
    setSampleError('');
  };

  const handleExecutorChange = (employee: Employee | null) => {
    setExecutor(employee);
    setExecutorError('');
  };

  const handleEquipmentChange = (value: number[]) => {
    const requiredIds = availableEquipment.required.map(eq => eq.id);
    setSelectedEquipment(value.filter(id => !requiredIds.includes(id)));
  };

  const removeOptionalEquipment = (equipmentId: number) => {
    setSelectedEquipment(prev => prev.filter(id => id !== equipmentId));
  };

  const handleSave = async () => {
    const finalSampleId = sampleId ?? selectedSampleId;

    if (!finalSampleId) {
      setSampleError('Необходимо указать пробу');
      notify.warning('Укажите пробу');
      return;
    }

    if (!executor || !executor.hsnils) {
      setExecutorError('Необходимо указать исполнителя');
      notify.warning('Укажите исполнителя');
      return;
    }

    if (!laboratoryActivityDate) {
      notify.warning('Необходимо указать дату лабораторной деятельности');
      return;
    }

    setExecutorError('');
    setSampleError('');

    try {
      const resolvedEquipment = showEquipmentField
        ? allSelectedEquipment.length > 0
          ? allSelectedEquipment
          : equipment_data
        : [];

      const payload = {
        sample_id: finalSampleId,
        laboratory_id: laboratoryId,
        department_id: departmentId,
        research_method_id: researchMethodId,
        input_data: calculationData.input_data,
        equipment_data: resolvedEquipment,
        result: calculationData.result,
        executor: executor.hsnils,
        measurement_error: calculationData.measurement_error,
        unit: calculationData.unit,
        laboratory_activity_date: laboratoryActivityDate.format('YYYY-MM-DD'),
      };

      if (editingCalculationId) {
        await replaceCalculationMutation.mutateAsync({
          id: editingCalculationId,
          data: payload,
        });
      } else {
        await createCalculationMutation.mutateAsync(payload);
      }
      setExecutor(null);
      onSuccess();
      onClose();
    } catch (error) {
      notify.error('Не удалось сохранить расчёт');
      throw error;
    }
  };

  const handleCancel = () => {
    setExecutor(null);
    setExecutorError('');
    onClose();
  };

  return {
    showEquipmentField,
    executor,
    executorError,
    selectedSampleId,
    sampleError,
    laboratoryName,
    selectedEquipment,
    samples,
    samplesLoading,
    availableEquipment,
    allSelectedEquipment,
    isLoadingEquipment,
    editingCalculationId,
    handleSampleChange,
    handleExecutorChange,
    handleEquipmentChange,
    removeOptionalEquipment,
    handleSave,
    handleCancel,
  };
};
