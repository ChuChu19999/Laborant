import { useState, useEffect, useRef } from 'react';
import {
  useBulkUpdateMassFractionOilRefractionTable,
  useRefractionTablesByMethod,
} from '@/entities/MassFractionOilRefraction';
import { extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';

interface EntryRow {
  id: string;
  c_value: string;
  n_value: string;
  table_id?: number;
}

/** Вернуть клиентский ключ для новых строк черновика (не уходит в API). */
function createClientKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ck-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Сравнить записи по содержимому строк (id из БД или временный id), без привязки к порядку. */
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

function mapTablesToEntries(
  items: { id: number; c_value: unknown; n_value: unknown; deleted_at?: string | null }[]
): EntryRow[] {
  const activeTables = items.filter(item => !item.deleted_at);
  return activeTables.map(table => ({
    id: `entry-${table.id}`,
    c_value: String(table.c_value),
    n_value: String(table.n_value),
    table_id: table.id,
  }));
}

export type UseMassFractionOilRefractionDirectoryModalParams = {
  open: boolean;
  onClose: () => void;
  researchMethodId?: number;
  canUpdate?: boolean;
};

/** Оркестрировать модалку справочника рефрактометрической таблицы. */
export const useMassFractionOilRefractionDirectoryModal = ({
  open,
  onClose,
  researchMethodId,
  canUpdate = true,
}: UseMassFractionOilRefractionDirectoryModalParams) => {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [originalEntries, setOriginalEntries] = useState<EntryRow[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newEntry, setNewEntry] = useState({ c_value: '', n_value: '' });

  const hydratedKeyRef = useRef<string | null>(null);

  const bulkUpdateMutation = useBulkUpdateMassFractionOilRefractionTable();

  const { data: tablesData, isLoading } = useRefractionTablesByMethod(
    researchMethodId,
    open && !!researchMethodId
  );

  const hydrateKey = open && researchMethodId != null ? String(researchMethodId) : null;

  useEffect(() => {
    if (!hydrateKey) {
      hydratedKeyRef.current = null;
      return;
    }
    if (hydratedKeyRef.current === hydrateKey || isLoading) {
      return;
    }

    const items = tablesData?.items ?? [];
    const entriesList = items.length > 0 ? mapTablesToEntries(items) : [];
    setEntries(entriesList);
    setOriginalEntries(structuredClone(entriesList));
    hydratedKeyRef.current = hydrateKey;
  }, [hydrateKey, isLoading, tablesData]);

  const handleAdd = () => {
    if (!newEntry.c_value.trim() || !newEntry.n_value.trim()) {
      notify.warning('Заполните оба поля');
      return;
    }

    const cValue = parseFloat(newEntry.c_value.replace(',', '.'));
    const nValue = parseFloat(newEntry.n_value.replace(',', '.'));

    if (isNaN(cValue) || isNaN(nValue)) {
      notify.warning('Введите корректные числовые значения');
      return;
    }

    if (cValue < 0 || cValue > 100) {
      notify.warning('Массовая доля масла должна быть в диапазоне от 0 до 100');
      return;
    }

    const entry: EntryRow = {
      id: createClientKey(),
      c_value: newEntry.c_value.trim(),
      n_value: newEntry.n_value.trim(),
    };

    setEntries(prev => [...prev, entry]);
    setNewEntry({ c_value: '', n_value: '' });
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    const entry = entries[index];
    if (!entry) {
      return;
    }
    setNewEntry({
      c_value: entry.c_value.replace(/\./g, ','),
      n_value: entry.n_value.replace(/\./g, ','),
    });
  };

  const handleUpdate = () => {
    if (!newEntry.c_value.trim() || !newEntry.n_value.trim()) {
      notify.warning('Заполните оба поля');
      return;
    }

    const cValue = parseFloat(newEntry.c_value.replace(',', '.'));
    const nValue = parseFloat(newEntry.n_value.replace(',', '.'));

    if (isNaN(cValue) || isNaN(nValue)) {
      notify.warning('Введите корректные числовые значения');
      return;
    }

    if (cValue < 0 || cValue > 100) {
      notify.warning('Массовая доля масла должна быть в диапазоне от 0 до 100');
      return;
    }

    if (editingIndex === null) return;

    const updatedEntries = [...entries];
    const existing = updatedEntries[editingIndex];
    if (!existing) {
      return;
    }
    updatedEntries[editingIndex] = {
      ...existing,
      c_value: newEntry.c_value.trim(),
      n_value: newEntry.n_value.trim(),
    };
    setEntries(updatedEntries);
    setEditingIndex(null);
    setNewEntry({ c_value: '', n_value: '' });
  };

  const handleDelete = (index: number) => {
    const updatedEntries = entries.filter((_, idx) => idx !== index);
    setEntries(updatedEntries);
  };

  const handleEditCancel = () => {
    setEditingIndex(null);
    setNewEntry({ c_value: '', n_value: '' });
  };

  const handleSave = async () => {
    try {
      const changed = !refractionEntriesShallowEqual(entries, originalEntries);

      if (!changed) {
        notify.info('Изменений не обнаружено');
        onClose();
        return;
      }

      if (!researchMethodId) {
        notify.error('Не указан метод исследования');
        return;
      }

      await bulkUpdateMutation.mutateAsync({
        research_method_id: researchMethodId,
        entries: entries.map(entry => ({
          c_value: toApiDecimalString(entry.c_value),
          n_value: toApiDecimalString(entry.n_value),
        })),
      });

      onClose();
    } catch (error) {
      notify.error(extractErrorMessage(error, 'Не удалось сохранить рефрактометрическую таблицу'));
    }
  };

  const handleCValueChange = (value: string) => {
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
  };

  const handleNValueChange = (value: string) => {
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
  };

  const hasChanges = !refractionEntriesShallowEqual(entries, originalEntries);

  const handleCancel = () => {
    if (hasChanges) {
      setEntries(structuredClone(originalEntries));
      setEditingIndex(null);
      setNewEntry({ c_value: '', n_value: '' });
      notify.info('Изменения отменены');
    }
    onClose();
  };

  return {
    entries,
    editingIndex,
    newEntry,
    isLoading,
    canUpdate,
    handleAdd,
    handleEdit,
    handleUpdate,
    handleDelete,
    handleEditCancel,
    handleSave,
    handleCValueChange,
    handleNValueChange,
    handleCancel,
  };
};
