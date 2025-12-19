import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { message } from 'antd';
import { SelectionConditionsTable } from '../../../../entities/SelectionConditionsTable';
import { selectionConditionsApi } from '../../../../shared/api/selectionConditions';
import {
  useCreateSelectionConditions,
  useUpdateSelectionConditions,
} from '../../../../shared/model/hooks';
import { useAutoRefetchQuery } from '../../../../shared/model/lib/useQuery';
import Button from '../../../../shared/ui/Button/Button';
import { Input } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import type { SelectionCondition } from '../../../../shared/api/selectionConditions';
import './SelectionConditionsModal.css';

interface SelectionConditionsModalProps {
  open: boolean;
  onClose: () => void;
  laboratoryId?: number;
  departmentId?: number;
  entityName?: string;
}

interface ConditionRow extends SelectionCondition {
  id: string;
}

const SelectionConditionsModal: React.FC<SelectionConditionsModalProps> = ({
  open,
  onClose,
  laboratoryId,
  departmentId,
  entityName,
}) => {
  const [conditions, setConditions] = useState<ConditionRow[]>([]);
  const [originalConditions, setOriginalConditions] = useState<ConditionRow[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newCondition, setNewCondition] = useState<SelectionCondition>({ variable: '', unit: '' });

  const createMutation = useCreateSelectionConditions();
  const updateMutation = useUpdateSelectionConditions();

  const { data: conditionsData, isLoading } = useAutoRefetchQuery(
    ['selection-conditions', laboratoryId, departmentId],
    () => selectionConditionsApi.getSelectionConditions(laboratoryId, departmentId),
    {
      enabled: open && !!laboratoryId,
    }
  );

  useEffect(() => {
    if (conditionsData?.items && conditionsData.items.length > 0) {
      const activeConditions = conditionsData.items.find(item => !item.deleted_at);
      const conditionsList = activeConditions?.conditions || [];
      const conditionsWithIds = conditionsList.map((cond, idx) => ({
        ...cond,
        id: `condition-${idx}`,
      }));
      setConditions(conditionsWithIds);
      setOriginalConditions(JSON.parse(JSON.stringify(conditionsWithIds)));
    } else {
      setConditions([]);
      setOriginalConditions([]);
    }
  }, [conditionsData]);

  const handleAdd = useCallback(() => {
    if (!newCondition.variable.trim() || !newCondition.unit.trim()) {
      message.warning('Заполните все поля');
      return;
    }

    const condition: ConditionRow = {
      ...newCondition,
      variable: newCondition.variable.trim(),
      unit: newCondition.unit.trim(),
      id: `condition-${Date.now()}`,
    };

    setConditions([...conditions, condition]);
    setNewCondition({ variable: '', unit: '' });
  }, [newCondition, conditions]);

  const handleEdit = useCallback(
    (index: number) => {
      setEditingIndex(index);
      setNewCondition(conditions[index]);
    },
    [conditions]
  );

  const handleUpdate = useCallback(() => {
    if (!newCondition.variable.trim() || !newCondition.unit.trim()) {
      message.warning('Заполните все поля');
      return;
    }

    if (editingIndex === null) return;

    const updatedConditions = [...conditions];
    updatedConditions[editingIndex] = {
      ...newCondition,
      variable: newCondition.variable.trim(),
      unit: newCondition.unit.trim(),
      id: updatedConditions[editingIndex].id,
    };
    setConditions(updatedConditions);
    setEditingIndex(null);
    setNewCondition({ variable: '', unit: '' });
  }, [newCondition, editingIndex, conditions]);

  const handleDelete = useCallback(
    (index: number) => {
      const updatedConditions = conditions.filter((_, idx) => idx !== index);
      setConditions(updatedConditions);
    },
    [conditions]
  );

  const handleEditCancel = useCallback(() => {
    setEditingIndex(null);
    setNewCondition({ variable: '', unit: '' });
  }, []);

  const areConditionsEqual = useCallback(
    (conditions1: ConditionRow[], conditions2: ConditionRow[]) => {
      if (conditions1.length !== conditions2.length) return false;

      const sorted1 = [...conditions1].sort((a, b) => a.variable.localeCompare(b.variable));
      const sorted2 = [...conditions2].sort((a, b) => a.variable.localeCompare(b.variable));

      return JSON.stringify(sorted1) === JSON.stringify(sorted2);
    },
    []
  );

  const handleSave = useCallback(async () => {
    try {
      const hasChanges = !areConditionsEqual(conditions, originalConditions);

      if (!hasChanges) {
        message.info('Изменений не обнаружено');
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

      const existingConditions = await selectionConditionsApi.getSelectionConditions(
        laboratoryId,
        departmentId
      );

      if (existingConditions.items.length > 0 && !existingConditions.items[0].deleted_at) {
        const activeCondition = existingConditions.items[0];
        await updateMutation.mutateAsync({ id: activeCondition.id, data });
      } else {
        await createMutation.mutateAsync(data);
      }

      onClose();
    } catch (error) {
      console.error('Ошибка при сохранении условий отбора:', error);
    }
  }, [
    conditions,
    originalConditions,
    laboratoryId,
    departmentId,
    areConditionsEqual,
    onClose,
    updateMutation,
    createMutation,
  ]);

  const hasChanges = useMemo(
    () => !areConditionsEqual(conditions, originalConditions),
    [conditions, originalConditions, areConditionsEqual]
  );

  const handleCancel = useCallback(() => {
    if (hasChanges) {
      setConditions(JSON.parse(JSON.stringify(originalConditions)));
      setEditingIndex(null);
      setNewCondition({ variable: '', unit: '' });
      message.info('Изменения отменены');
    }
    onClose();
  }, [hasChanges, originalConditions, onClose]);

  if (!open) return null;

  return (
    <Modal
      header={`Условия отбора - ${entityName || ''}${hasChanges ? ' (изменено)' : ''}`}
      onClose={onClose}
      onCancel={handleCancel}
      showEditButton={false}
      editable={false}
      modalWidth="1000"
      onSave={handleSave}
    >
      <div className="selection-conditions-modal-content">
        <div className="selection-conditions-modal-form">
          <div className="form-row">
            <Input
              placeholder="Переменная"
              value={newCondition.variable}
              onChange={e => setNewCondition({ ...newCondition, variable: e.target.value })}
              className="selection-conditions-modal-input"
            />
            <Input
              placeholder="Единица измерения"
              value={newCondition.unit}
              onChange={e => setNewCondition({ ...newCondition, unit: e.target.value })}
              className="selection-conditions-modal-input"
            />
            {editingIndex === null ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                Добавить
              </Button>
            ) : (
              <div className="selection-conditions-modal-actions">
                <Button
                  type="primary"
                  onClick={handleUpdate}
                  className="selection-conditions-modal-save-button"
                >
                  Сохранить
                </Button>
                <Button
                  onClick={handleEditCancel}
                  className="selection-conditions-modal-cancel-button"
                >
                  Отмена
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="selection-conditions-modal-table-container">
          <SelectionConditionsTable
            data={conditions}
            loading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </Modal>
  );
};

export default SelectionConditionsModal;
