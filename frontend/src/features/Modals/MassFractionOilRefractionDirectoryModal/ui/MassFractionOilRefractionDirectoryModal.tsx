import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { message } from 'antd';
import { MassFractionOilRefractionDirectoryTable } from '../../../../entities/Tables/MassFractionOilRefractionDirectoryTable';
import { refractionTablesApi } from '../../../../shared/api/refractionTables';
import { useBulkUpdateMassFractionOilRefractionTable } from '../../../../shared/model/hooks';
import { useAutoRefetchQuery } from '../../../../shared/model/lib/useQuery';
import Button from '../../../../shared/ui/Button/Button';
import { Input } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import { formatNumberForDisplay } from '../../../../shared/utils/numberFormatting';
import './MassFractionOilRefractionDirectoryModal.css';

interface MassFractionOilRefractionDirectoryModalProps {
  open: boolean;
  onClose: () => void;
  researchMethodId?: number;
  methodName?: string;
}

interface EntryRow {
  id: string;
  c_value: number;
  n_value: number;
  table_id?: number;
}

const MassFractionOilRefractionDirectoryModal: React.FC<
  MassFractionOilRefractionDirectoryModalProps
> = ({ open, onClose, researchMethodId, methodName }) => {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [originalEntries, setOriginalEntries] = useState<EntryRow[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newEntry, setNewEntry] = useState({ c_value: '', n_value: '' });

  const bulkUpdateMutation = useBulkUpdateMassFractionOilRefractionTable();

  const { data: tablesData, isLoading } = useAutoRefetchQuery(
    ['refraction-tables', researchMethodId],
    () =>
      refractionTablesApi.getRefractionTables(
        researchMethodId,
        undefined,
        undefined,
        'c_value',
        'asc'
      ),
    {
      enabled: open && !!researchMethodId,
    }
  );

  useEffect(() => {
    if (tablesData?.items && tablesData.items.length > 0) {
      const activeTables = tablesData.items.filter(item => !item.deleted_at);
      const entriesList = activeTables.map(table => ({
        id: `entry-${table.id}`,
        c_value: parseFloat(table.c_value) || 0,
        n_value: parseFloat(table.n_value) || 0,
        table_id: table.id,
      }));
      setEntries(entriesList);
      setOriginalEntries(JSON.parse(JSON.stringify(entriesList)));
    } else {
      setEntries([]);
      setOriginalEntries([]);
    }
  }, [tablesData]);

  const handleAdd = useCallback(() => {
    if (!newEntry.c_value.trim() || !newEntry.n_value.trim()) {
      message.warning('Заполните все поля');
      return;
    }

    const cValue = parseFloat(newEntry.c_value.replace(',', '.'));
    const nValue = parseFloat(newEntry.n_value.replace(',', '.'));

    if (isNaN(cValue) || isNaN(nValue)) {
      message.warning('Введите корректные числовые значения');
      return;
    }

    if (cValue < 0 || cValue > 100) {
      message.warning('Массовая доля нефти должна быть в диапазоне от 0 до 100');
      return;
    }

    const entry: EntryRow = {
      id: `entry-${Date.now()}`,
      c_value: cValue,
      n_value: nValue,
    };

    setEntries([...entries, entry]);
    setNewEntry({ c_value: '', n_value: '' });
  }, [newEntry, entries]);

  const handleEdit = useCallback(
    (index: number) => {
      setEditingIndex(index);
      const entry = entries[index];
      setNewEntry({
        c_value: formatNumberForDisplay(entry.c_value),
        n_value: formatNumberForDisplay(entry.n_value),
      });
    },
    [entries]
  );

  const handleUpdate = useCallback(() => {
    if (!newEntry.c_value.trim() || !newEntry.n_value.trim()) {
      message.warning('Заполните все поля');
      return;
    }

    const cValue = parseFloat(newEntry.c_value.replace(',', '.'));
    const nValue = parseFloat(newEntry.n_value.replace(',', '.'));

    if (isNaN(cValue) || isNaN(nValue)) {
      message.warning('Введите корректные числовые значения');
      return;
    }

    if (cValue < 0 || cValue > 100) {
      message.warning('Массовая доля нефти должна быть в диапазоне от 0 до 100');
      return;
    }

    if (editingIndex === null) return;

    const updatedEntries = [...entries];
    updatedEntries[editingIndex] = {
      ...updatedEntries[editingIndex],
      c_value: cValue,
      n_value: nValue,
    };
    setEntries(updatedEntries);
    setEditingIndex(null);
    setNewEntry({ c_value: '', n_value: '' });
  }, [newEntry, editingIndex, entries]);

  const handleDelete = useCallback(
    (index: number) => {
      const updatedEntries = entries.filter((_, idx) => idx !== index);
      setEntries(updatedEntries);
    },
    [entries]
  );

  const handleEditCancel = useCallback(() => {
    setEditingIndex(null);
    setNewEntry({ c_value: '', n_value: '' });
  }, []);

  const areEntriesEqual = useCallback((entries1: EntryRow[], entries2: EntryRow[]) => {
    if (entries1.length !== entries2.length) return false;

    const sorted1 = [...entries1].sort((a, b) => a.c_value - b.c_value);
    const sorted2 = [...entries2].sort((a, b) => a.c_value - b.c_value);

    for (let i = 0; i < sorted1.length; i++) {
      if (
        Math.abs(sorted1[i].c_value - sorted2[i].c_value) > 0.01 ||
        Math.abs(sorted1[i].n_value - sorted2[i].n_value) > 0.001
      ) {
        return false;
      }
    }

    return true;
  }, []);

  const handleSave = useCallback(async () => {
    try {
      const hasChanges = !areEntriesEqual(entries, originalEntries);

      if (!hasChanges) {
        message.info('Изменений не обнаружено');
        onClose();
        return;
      }

      if (!researchMethodId) {
        message.error('Не указан метод исследования');
        return;
      }

      await bulkUpdateMutation.mutateAsync({
        research_method_id: researchMethodId,
        entries: entries.map(entry => ({
          c_value: entry.c_value,
          n_value: entry.n_value,
        })),
      });

      onClose();
    } catch (error) {
      console.error('Ошибка при сохранении справочника:', error);
    }
  }, [entries, originalEntries, researchMethodId, areEntriesEqual, onClose, bulkUpdateMutation]);

  const handleCValueChange = useCallback((value: string) => {
    const processedValue = value.replace(/\./g, ',');
    const pattern = /^-?\d*,?\d*$/;

    if (processedValue === '' || processedValue === '-' || pattern.test(processedValue)) {
      const commaCount = (processedValue.match(/,/g) || []).length;
      if (commaCount <= 1) {
        const minusCount = (processedValue.match(/-/g) || []).length;
        if (minusCount <= 1 && processedValue.indexOf('-') <= 0) {
          setNewEntry(prev => ({ ...prev, c_value: processedValue }));
        }
      }
    }
  }, []);

  const handleNValueChange = useCallback((value: string) => {
    const processedValue = value.replace(/\./g, ',');
    const pattern = /^-?\d*,?\d*$/;

    if (processedValue === '' || processedValue === '-' || pattern.test(processedValue)) {
      const commaCount = (processedValue.match(/,/g) || []).length;
      if (commaCount <= 1) {
        const minusCount = (processedValue.match(/-/g) || []).length;
        if (minusCount <= 1 && processedValue.indexOf('-') <= 0) {
          setNewEntry(prev => ({ ...prev, n_value: processedValue }));
        }
      }
    }
  }, []);

  const hasChanges = useMemo(
    () => !areEntriesEqual(entries, originalEntries),
    [entries, originalEntries, areEntriesEqual]
  );

  const handleCancel = useCallback(() => {
    if (hasChanges) {
      setEntries(JSON.parse(JSON.stringify(originalEntries)));
      setEditingIndex(null);
      setNewEntry({ c_value: '', n_value: '' });
      message.info('Изменения отменены');
    }
    onClose();
  }, [hasChanges, originalEntries, onClose]);

  if (!open) return null;

  return (
    <Modal
      header={`Справочник массовой доли нефти - ${methodName || ''}${hasChanges ? ' (изменено)' : ''}`}
      onClose={onClose}
      onCancel={handleCancel}
      showEditButton={false}
      editable={false}
      modalWidth="1000"
      onSave={handleSave}
    >
      <div className="mass-fraction-oil-refraction-directory-modal-content">
        <div className="mass-fraction-oil-refraction-directory-modal-form">
          <div className="form-row">
            <Input
              placeholder="Массовая доля нефти (C), %"
              value={newEntry.c_value}
              onChange={e => handleCValueChange(e.target.value)}
              className="mass-fraction-oil-refraction-directory-modal-input"
            />
            <Input
              placeholder="Показатель преломления (n)"
              value={newEntry.n_value}
              onChange={e => handleNValueChange(e.target.value)}
              className="mass-fraction-oil-refraction-directory-modal-input"
            />
            {editingIndex === null ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                Добавить
              </Button>
            ) : (
              <div className="mass-fraction-oil-refraction-directory-modal-actions">
                <Button
                  type="primary"
                  onClick={handleUpdate}
                  className="mass-fraction-oil-refraction-directory-modal-save-button"
                >
                  Сохранить
                </Button>
                <Button
                  onClick={handleEditCancel}
                  className="mass-fraction-oil-refraction-directory-modal-cancel-button"
                >
                  Отмена
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="mass-fraction-oil-refraction-directory-modal-table-container">
          <MassFractionOilRefractionDirectoryTable
            data={entries}
            loading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </Modal>
  );
};

export default MassFractionOilRefractionDirectoryModal;
