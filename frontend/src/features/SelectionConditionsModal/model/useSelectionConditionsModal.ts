import { useState, useEffect, useRef } from 'react';
import {
  useCreateSelectionConditions,
  useSelectionConditions,
  useUpdateSelectionConditions,
  type SelectionCondition,
} from '@/entities/SelectionCondition';
import { extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';

export type UseSelectionConditionsModalParams = {
  open: boolean;
  onClose: () => void;
  laboratoryId?: number;
  departmentId?: number;
};

interface ConditionRow extends SelectionCondition {
  id: string;
}

/** Клиентский ключ для строк черновика (не уходит в API). */
function createClientKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ck-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Сравнить условия отбора без учёта порядка строк. */
function areConditionsEqual(conditions1: ConditionRow[], conditions2: ConditionRow[]): boolean {
  if (conditions1.length !== conditions2.length) return false;

  const sorted1 = [...conditions1].sort((a, b) => a.variable.localeCompare(b.variable));
  const sorted2 = [...conditions2].sort((a, b) => a.variable.localeCompare(b.variable));

  return JSON.stringify(sorted1) === JSON.stringify(sorted2);
}

/** Оркестрировать состояние и сохранение модалки условий отбора. */
export const useSelectionConditionsModal = ({
  open,
  onClose,
  laboratoryId,
  departmentId,
}: UseSelectionConditionsModalParams) => {
  const [conditions, setConditions] = useState<ConditionRow[]>([]);
  const [originalConditions, setOriginalConditions] = useState<ConditionRow[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newCondition, setNewCondition] = useState<SelectionCondition>({ variable: '', unit: '' });

  const hydratedKeyRef = useRef<string | null>(null);

  const createMutation = useCreateSelectionConditions();
  const updateMutation = useUpdateSelectionConditions();

  const { data: conditionsData, isLoading } = useSelectionConditions(
    laboratoryId,
    departmentId,
    open && !!laboratoryId
  );

  const hydrateKey = open && laboratoryId != null ? `${laboratoryId}:${departmentId ?? ''}` : null;

  useEffect(() => {
    if (!hydrateKey) {
      hydratedKeyRef.current = null;
      return;
    }
    if (hydratedKeyRef.current === hydrateKey || isLoading) {
      return;
    }

    if (conditionsData?.items && conditionsData.items.length > 0) {
      const activeConditions = conditionsData.items.find(item => !item.deleted_at);
      const conditionsList = activeConditions?.conditions || [];
      const conditionsWithIds = conditionsList.map(cond => ({
        ...cond,
        id: createClientKey(),
      }));
      setConditions(conditionsWithIds);
      setOriginalConditions(structuredClone(conditionsWithIds));
    } else {
      setConditions([]);
      setOriginalConditions([]);
    }
    hydratedKeyRef.current = hydrateKey;
  }, [hydrateKey, isLoading, conditionsData]);

  const handleAdd = () => {
    if (!newCondition.variable.trim() || !newCondition.unit.trim()) {
      notify.warning('Заполните оба поля');
      return;
    }

    const condition: ConditionRow = {
      ...newCondition,
      variable: newCondition.variable.trim(),
      unit: newCondition.unit.trim(),
      id: createClientKey(),
    };

    setConditions(prev => [...prev, condition]);
    setNewCondition({ variable: '', unit: '' });
  };

  const handleEdit = (index: number) => {
    const condition = conditions[index];
    if (!condition) {
      return;
    }
    setEditingIndex(index);
    setNewCondition(condition);
  };

  const handleUpdate = () => {
    if (!newCondition.variable.trim() || !newCondition.unit.trim()) {
      notify.warning('Заполните оба поля');
      return;
    }

    if (editingIndex === null) return;

    const updatedConditions = [...conditions];
    const existing = updatedConditions[editingIndex];
    if (!existing) {
      return;
    }
    updatedConditions[editingIndex] = {
      ...newCondition,
      variable: newCondition.variable.trim(),
      unit: newCondition.unit.trim(),
      id: existing.id,
    };
    setConditions(updatedConditions);
    setEditingIndex(null);
    setNewCondition({ variable: '', unit: '' });
  };

  const handleDelete = (index: number) => {
    setConditions(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleEditCancel = () => {
    setEditingIndex(null);
    setNewCondition({ variable: '', unit: '' });
  };

  const handleSave = async () => {
    try {
      const changed = !areConditionsEqual(conditions, originalConditions);

      if (!changed) {
        notify.info('Изменений не обнаружено');
        onClose();
        return;
      }

      const data = {
        conditions: conditions.map(condition => ({
          variable: condition.variable,
          unit: condition.unit,
        })),
        laboratory_id: laboratoryId,
        department_id: departmentId,
      };

      const existingItem = conditionsData?.items?.find(item => !item.deleted_at);
      if (existingItem) {
        await updateMutation.mutateAsync({ id: existingItem.id, data });
      } else {
        await createMutation.mutateAsync(data);
      }

      onClose();
    } catch (error) {
      notify.error(extractErrorMessage(error, 'Не удалось сохранить условия отбора'));
    }
  };

  const hasChanges = !areConditionsEqual(conditions, originalConditions);

  const handleCancel = () => {
    if (hasChanges) {
      setConditions(structuredClone(originalConditions));
      setEditingIndex(null);
      setNewCondition({ variable: '', unit: '' });
      notify.info('Изменения отменены');
    }
    onClose();
  };

  return {
    conditions,
    editingIndex,
    newCondition,
    setNewCondition,
    isLoading,
    hasChanges,
    handleAdd,
    handleEdit,
    handleUpdate,
    handleDelete,
    handleEditCancel,
    handleSave,
    handleCancel,
  };
};
