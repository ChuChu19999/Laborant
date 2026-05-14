import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { message } from 'antd';
import { MassFractionOilRefractionDirectoryTable } from '../../../../entities/Tables/MassFractionOilRefractionDirectoryTable';
import { refractionTablesApi } from '../../../../shared/api/refractionTables';
import { useBulkUpdateMassFractionOilRefractionTable } from '../../../../shared/model/hooks';
import { useAutoRefetchQuery } from '../../../../shared/model/lib/useQuery';
import Button from '../../../../shared/ui/Button/Button';
import { Input } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import './MassFractionOilRefractionDirectoryModal.css';

interface MassFractionOilRefractionDirectoryModalProps {
  open: boolean;
  onClose: () => void;
  researchMethodId?: number;
  methodName?: string;
}

interface EntryRow {
  id: string;
  c_value: string;
  n_value: string;
  table_id?: number;
}

/** Сравнение по стабильному ключу строки (id из БД или временный id), без порядка в таблице. */
function refractionEntriesShallowEqual(a: EntryRow[], b: EntryRow[]): boolean {
  if (a.length !== b.length) return false;
  const toMap = (arr: EntryRow[]) => {
    const m = new Map<string, { c: string; n: string }>();
    for (const e of arr) {
      const key = e.table_id != null ? `t:${e.table_id}` : e.id;
      m.set(key, { c: e.c_value.trim(), n: e.n_value.trim() });
    }
    return m;
  };
  const ma = toMap(a);
  const mb = toMap(b);
  if (ma.size !== mb.size) return false;
  for (const [key, va] of ma) {
    const vb = mb.get(key);
    if (!vb) return false;
    if (va.c !== vb.c || va.n !== vb.n) return false;
  }
  return true;
}

function toApiDecimalString(v: string): string {
  return String(v).trim().replace(/\s+/g, '').replace(/,/g, '.');
}

const MassFractionOilRefractionDirectoryModal: React.FC<
  MassFractionOilRefractionDirectoryModalProps
> = ({ open, onClose, researchMethodId }) => {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [originalEntries, setOriginalEntries] = useState<EntryRow[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newEntry, setNewEntry] = useState({ c_value: '', n_value: '' });

  /** Пока true — не подменять entries из react-query (иначе фоновый refetch затирает правки до «Сохранить»). */
  const hasLocalEditsRef = useRef(false);
  const prevOpenRef = useRef(false);

  const bulkUpdateMutation = useBulkUpdateMassFractionOilRefractionTable();

  const {
    data: tablesData,
    isLoading,
    refetch,
  } = useAutoRefetchQuery(
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
    if (open && !prevOpenRef.current) {
      hasLocalEditsRef.current = false;
    }
    prevOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open || !researchMethodId) return;
    if (hasLocalEditsRef.current) {
      return;
    }
    if (tablesData?.items && tablesData.items.length > 0) {
      const activeTables = tablesData.items.filter(item => !item.deleted_at);
      const entriesList = activeTables.map(table => ({
        id: `entry-${table.id}`,
        c_value: String(table.c_value),
        n_value: String(table.n_value),
        table_id: table.id,
      }));
      setEntries(entriesList);
      setOriginalEntries(JSON.parse(JSON.stringify(entriesList)));
    } else {
      setEntries([]);
      setOriginalEntries([]);
    }
  }, [tablesData, open, researchMethodId]);

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
      c_value: newEntry.c_value.trim(),
      n_value: newEntry.n_value.trim(),
    };

    hasLocalEditsRef.current = true;
    setEntries([...entries, entry]);
    setNewEntry({ c_value: '', n_value: '' });
  }, [newEntry, entries]);

  const handleEdit = useCallback(
    (index: number) => {
      setEditingIndex(index);
      const entry = entries[index];
      setNewEntry({
        c_value: entry.c_value.replace(/\./g, ','),
        n_value: entry.n_value.replace(/\./g, ','),
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
      c_value: newEntry.c_value.trim(),
      n_value: newEntry.n_value.trim(),
    };
    hasLocalEditsRef.current = true;
    setEntries(updatedEntries);
    setEditingIndex(null);
    setNewEntry({ c_value: '', n_value: '' });
  }, [newEntry, editingIndex, entries]);

  const handleDelete = useCallback(
    (index: number) => {
      hasLocalEditsRef.current = true;
      const updatedEntries = entries.filter((_, idx) => idx !== index);
      setEntries(updatedEntries);
    },
    [entries]
  );

  const handleEditCancel = useCallback(() => {
    setEditingIndex(null);
    setNewEntry({ c_value: '', n_value: '' });
  }, []);

  const handleSave = useCallback(async () => {
    try {
      const hasChanges = !refractionEntriesShallowEqual(entries, originalEntries);

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
          c_value: toApiDecimalString(entry.c_value),
          n_value: toApiDecimalString(entry.n_value),
        })),
      });

      hasLocalEditsRef.current = false;
      await refetch();
      onClose();
    } catch (error) {
      console.error('Ошибка при сохранении справочника:', error);
    }
  }, [entries, originalEntries, researchMethodId, onClose, bulkUpdateMutation, refetch]);

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
    () => !refractionEntriesShallowEqual(entries, originalEntries),
    [entries, originalEntries]
  );

  const handleCancel = useCallback(() => {
    if (hasChanges) {
      hasLocalEditsRef.current = false;
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
      header={`Градуировочный график`}
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
