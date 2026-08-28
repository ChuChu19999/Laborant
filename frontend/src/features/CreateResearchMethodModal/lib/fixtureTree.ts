import type { FixtureData, SavedMethodsTreeResponse } from '@/entities/ResearchMethod';
import type { TreeSelectProps } from '@/shared/ui/TreeSelect';
import type { Key } from 'react';

/** Узел дерева готовых конфигураций / сохранённых методов. */
export type FixtureTreeNode = NonNullable<TreeSelectProps['treeData']>[number];

/** Формирует подпись пункта в дереве типовых конфигураций. */
export function formatFixtureTreeTitle(fixture: FixtureData, fallbackKey: string): string {
  const methodName = fixture.name || fallbackKey;
  const isFractionalComposition = methodName.toLowerCase().startsWith('фракционный состав');
  const displayName =
    fixture.group_name && fixture.name && !isFractionalComposition
      ? `${fixture.group_name} ${fixture.name.charAt(0).toLowerCase()}${fixture.name.slice(1)}`
      : methodName;
  const ndCode = fixture.nd_code || '';
  return `${displayName} (${ndCode})`;
}

/** Формирует подпись пункта в дереве сохранённых методов. */
export function formatSavedMethodTreeTitle(method: {
  name: string;
  nd_code: string;
  group_name?: string | null;
}): string {
  const isFractionalComposition = method.name.toLowerCase().startsWith('фракционный состав');
  const displayName =
    method.group_name && method.name && !isFractionalComposition
      ? `${method.group_name} ${method.name.charAt(0).toLowerCase()}${method.name.slice(1)}`
      : method.name;
  return `${displayName} (${method.nd_code})`;
}

/** Ключ лаборатории в дереве сохранённых методов. */
export function savedLaboratoryKey(id: number | null): string {
  return id === null ? 'none' : String(id);
}

/** Строит корень дерева лаборатория > подразделение > методы для подстановки из базы. */
export function buildSavedMethodsTreeRoot(data: SavedMethodsTreeResponse): FixtureTreeNode | null {
  if (!data.laboratories?.length) {
    return null;
  }

  return {
    title: 'Расчётные методы, применяемые в лабораториях',
    value: 'root-saved',
    key: 'root-saved',
    selectable: false,
    children: data.laboratories.map(lab => {
      const lk = savedLaboratoryKey(lab.laboratory_id);
      const underDept: FixtureTreeNode[] = lab.departments.map(d => ({
        title: d.department_name,
        value: `dept:${lk}:${d.department_id}`,
        key: `dept:${lk}:${d.department_id}`,
        selectable: false,
        children: d.methods.map(m => ({
          title: formatSavedMethodTreeTitle(m),
          value: `method:${m.id}`,
          key: `method:${m.id}`,
          isLeaf: true,
        })),
      }));
      const withoutDept: FixtureTreeNode[] = lab.methods_without_department.map(m => ({
        title: formatSavedMethodTreeTitle(m),
        value: `method:${m.id}`,
        key: `method:${m.id}`,
        isLeaf: true,
      }));
      return {
        title: lab.laboratory_name,
        value: `lab:${lk}`,
        key: `lab:${lk}`,
        selectable: false,
        children: [...underDept, ...withoutDept],
      };
    }),
  };
}

/** Обновляет дочерние узлы дерева по ключу. */
export function updateFixtureTreeChildren(
  list: FixtureTreeNode[],
  key: Key,
  children: FixtureTreeNode[]
): FixtureTreeNode[] {
  return list.map(node => {
    if (node.key === key) {
      return { ...node, children };
    }
    if (node.children && node.children.length > 0) {
      return {
        ...node,
        children: updateFixtureTreeChildren(node.children, key, children),
      };
    }
    return node;
  });
}
