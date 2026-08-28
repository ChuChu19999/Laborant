import { useEffect, useMemo, useState } from 'react';
import {
  useFixtureDirectories,
  useFixtureQueries,
  useResearchMethodQueries,
  useSavedMethodsTree,
} from '@/entities/ResearchMethod';
import { toDisplayString } from '@/shared/lib/formatting';
import { notify } from '@/shared/lib/notify';
import {
  buildSavedMethodsTreeRoot,
  formatFixtureTreeTitle,
  getConvergenceConditionsFromApiData,
  getIntermediateFieldsFromApiData,
  mapInputFieldsFromApi,
  methodToFormData,
  parseMeasurementErrorFromApi,
  updateFixtureTreeChildren,
} from '../lib';
import type { FixtureTreeNode, ResearchMethodFormData } from '../lib';
import type { FixtureData } from '@/entities/ResearchMethod';
import type { TreeSelectProps } from '@/shared/ui/TreeSelect';
import type { Dispatch, SetStateAction } from 'react';

type UseFixturePrefillParams = {
  open: boolean;
  enabled: boolean;
  laboratoryName?: string;
  setFormData: Dispatch<SetStateAction<ResearchMethodFormData>>;
};

/** Строит дерево типовых/сохраненных методов и подставляет выбранный шаблон в форму. */
export const useFixturePrefill = ({
  open,
  enabled,
  laboratoryName,
  setFormData,
}: UseFixturePrefillParams) => {
  const [selectedFixture, setSelectedFixture] = useState('');
  const [loadedDirChildren, setLoadedDirChildren] = useState<Record<string, FixtureTreeNode[]>>({});

  const { fetchFixture, fetchFixtureFiles } = useFixtureQueries();
  const { fetchResearchMethod } = useResearchMethodQueries();

  const savedTreeQuery = useSavedMethodsTree(open && enabled);
  const directoriesQuery = useFixtureDirectories(
    laboratoryName,
    open && enabled && laboratoryName != null && laboratoryName.trim() !== ''
  );

  useEffect(() => {
    if (!open) {
      setSelectedFixture('');
      setLoadedDirChildren({});
    }
  }, [open]);

  useEffect(() => {
    if (!open || !enabled) {
      return;
    }
    if (savedTreeQuery.isError) {
      notify.error('Не удалось загрузить справочник методов');
    }
  }, [open, enabled, savedTreeQuery.isError]);

  const baseTree = useMemo(() => {
    if (!enabled) {
      return [];
    }

    const tree: FixtureTreeNode[] = [];
    const directories = directoriesQuery.data?.directories ?? [];

    if (directories.length > 0) {
      tree.push({
        title: 'Типовые методы расчёта по разделам',
        value: 'root-fixtures',
        key: 'root-fixtures',
        selectable: false,
        children: directories.map(d => {
          const paths = d.paths?.length ? d.paths : [d.path];
          const dirKey = paths.join('|');
          return {
            title: d.label,
            value: `dir:${dirKey}`,
            key: `dir:${dirKey}`,
            selectable: false,
            isLeaf: false,
          };
        }),
      });
    }

    if (savedTreeQuery.data) {
      const savedRoot = buildSavedMethodsTreeRoot(savedTreeQuery.data);
      if (savedRoot) {
        tree.push(savedRoot);
      }
    }

    return tree;
  }, [directoriesQuery.data, enabled, savedTreeQuery.data]);

  const fixtureTreeData = useMemo(() => {
    let tree = baseTree;
    for (const [nodeKey, children] of Object.entries(loadedDirChildren)) {
      tree = updateFixtureTreeChildren(tree, nodeKey, children);
    }
    return tree;
  }, [baseTree, loadedDirChildren]);

  const applyFixtureDataToForm = (fixtureData: FixtureData) => {
    setFormData({
      name: fixtureData.name || '',
      sample_type: Array.isArray(fixtureData.sample_type)
        ? fixtureData.sample_type
        : fixtureData.sample_type
          ? [fixtureData.sample_type]
          : [],
      formula: fixtureData.formula || '',
      measurement_error: parseMeasurementErrorFromApi(fixtureData.measurement_error),
      unit: fixtureData.unit || '',
      measurement_method: fixtureData.measurement_method || '',
      nd_code: fixtureData.nd_code || '',
      nd_name: fixtureData.nd_name || '',
      input_data: mapInputFieldsFromApi(fixtureData.input_data),
      intermediate_data: {
        fields: getIntermediateFieldsFromApiData(fixtureData.intermediate_data),
      },
      convergence_conditions: getConvergenceConditionsFromApiData(
        fixtureData.convergence_conditions
      ),
      rounding_type: fixtureData.rounding_type || 'decimal',
      rounding_decimal: fixtureData.rounding_decimal || 0,
    });

    notify.success('Поля заполнены по типовому описанию из конфигурации');
  };

  const applyTemplateSelection = async (rawValue: string | undefined) => {
    const value = rawValue ?? '';
    setSelectedFixture(value);
    if (!value) {
      return;
    }
    if (
      value === 'root-fixtures' ||
      value === 'root-saved' ||
      value.startsWith('dir:') ||
      value.startsWith('lab:') ||
      value.startsWith('dept:')
    ) {
      return;
    }
    if (value.startsWith('fixture:')) {
      const path = value.slice('fixture:'.length);
      try {
        const fixtureData = await fetchFixture(path);
        applyFixtureDataToForm(fixtureData);
      } catch {
        notify.error('Не удалось загрузить выбранный типовой метод из конфигурации');
      }
      return;
    }
    if (value.startsWith('method:')) {
      const id = parseInt(value.slice('method:'.length), 10);
      if (Number.isNaN(id)) {
        notify.error('Некорректный идентификатор метода');
        return;
      }
      try {
        const method = await fetchResearchMethod(id);
        setFormData(methodToFormData(method));
        notify.success('Подставлены данные выбранного метода лаборатории');
      } catch {
        notify.error('Не удалось загрузить метод');
      }
    }
  };

  const loadFixtureFilesForDirectory = async (
    dataNode: Parameters<NonNullable<TreeSelectProps['loadData']>>[0]
  ) => {
    const keyStr = String(dataNode.key ?? '');
    if (!keyStr.startsWith('dir:')) {
      return;
    }
    if (dataNode.children && dataNode.children.length > 0) {
      return;
    }
    const dirPaths = keyStr.slice('dir:'.length).split('|').filter(Boolean);
    const nodeKey = dataNode.key;
    if (nodeKey === undefined || nodeKey === null) {
      return;
    }
    try {
      const fileEntries = await Promise.all(
        dirPaths.map(async dirPath => {
          const { files } = await fetchFixtureFiles(dirPath);
          return files.map(fn => ({ dirPath, fn }));
        })
      );
      const children: FixtureTreeNode[] = await Promise.all(
        fileEntries.flat().map(async ({ dirPath, fn }) => {
          const fullPath = `${dirPath}/${fn}`;
          const fallback = fn.replace(/\.json$/i, '');
          let title = fallback;
          try {
            const data = await fetchFixture(fullPath);
            title = formatFixtureTreeTitle(data, fallback);
          } catch {
            title = fallback;
          }
          return {
            title,
            value: `fixture:${fullPath}`,
            key: `fixture:${fullPath}`,
            isLeaf: true,
          };
        })
      );
      children.sort((a, b) =>
        toDisplayString(a.title).localeCompare(toDisplayString(b.title), 'ru')
      );
      setLoadedDirChildren(prev => ({
        ...prev,
        [String(nodeKey)]: children,
      }));
    } catch {
      notify.error('Не удалось загрузить список методов в выбранном разделе');
    }
  };

  return {
    fixtureTreeData,
    selectedFixture,
    isLoadingFixtures: savedTreeQuery.isLoading || directoriesQuery.isLoading,
    applyTemplateSelection,
    loadFixtureFilesForDirectory,
  };
};
