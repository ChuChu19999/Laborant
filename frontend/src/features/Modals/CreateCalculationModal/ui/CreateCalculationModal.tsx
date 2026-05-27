import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import { Checkbox, Radio, Spin, TreeSelect, message } from 'antd';
import { FormulaKeyboard } from '../../../../entities/FormulaKeyboard';
import {
  fixturesApi,
  type FixtureData,
  type SavedMethodsTreeResponse,
} from '../../../../shared/api/fixtures';
import { researchApi } from '../../../../shared/api/research';
import { useTestObjectSampleTypeOptions } from '../../../../shared/model/hooks';
import { Input, Select } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import type { ResearchMethod, ResearchMethodCreate } from '../../../../shared/api/research';
import type { InputRef, TreeSelectProps } from 'antd';
import './CreateCalculationModal.css';

const { Option } = Select;

const CONVERGENCE_OPTIONS = [
  { value: 'custom', label: 'Произвольная' },
  { value: 'satisfactory', label: 'Удовлетворительная' },
  { value: 'unsatisfactory', label: 'Неудовлетворительная' },
  { value: 'absence', label: 'Отсутствие' },
  { value: 'traces', label: 'Следы' },
];

type IntermediateFieldForm = {
  name: string;
  formula: string;
  description: string;
  unit?: string;
  show_calculation: boolean;
  use_multiple_rounding: boolean;
  multiple_value: string;
  use_result_rounding?: boolean;
  rounding_type?: 'decimal' | 'significant' | 'multiple';
  rounding_decimal?: number;
  range_calculation?: {
    ranges: Array<{ condition: string; formula: string }>;
  };
  use_threshold_table?: boolean;
  threshold_table_values?: {
    target_variable: string;
    higher_variable: string;
    lower_variable: string;
  };
};

type IntermediateFieldApi = ResearchMethodCreate['intermediate_data']['fields'][number];

function mapIntermediateFieldFromApi(
  field: IntermediateFieldForm & Record<string, unknown>
): IntermediateFieldForm {
  const useMultiple = Boolean(field.use_multiple_rounding);
  const useThreshold = Boolean(field.use_threshold_table);
  const rt = field.rounding_type;
  const hasLegacyCustom =
    !useMultiple &&
    !useThreshold &&
    field.use_result_rounding !== true &&
    (rt === 'decimal' || rt === 'significant') &&
    field.rounding_decimal != null;
  const useResultRounding = hasLegacyCustom ? false : field.use_result_rounding !== false;

  return {
    name: field.name ?? '',
    formula: field.formula ?? '',
    description: field.description ?? '',
    unit: field.unit ?? '',
    show_calculation: field.show_calculation ?? true,
    use_multiple_rounding: useMultiple,
    multiple_value: field.multiple_value ?? '',
    use_result_rounding: useResultRounding,
    rounding_type: rt === 'significant' ? 'significant' : 'decimal',
    rounding_decimal: field.rounding_decimal ?? 0,
    range_calculation: field.range_calculation,
    use_threshold_table: field.use_threshold_table,
    threshold_table_values: field.threshold_table_values,
  };
}

function serializeIntermediateFieldForApi(field: IntermediateFieldForm): IntermediateFieldApi {
  const payload: IntermediateFieldApi = {
    name: field.name,
    formula: field.use_threshold_table ? '0' : field.range_calculation ? '0' : field.formula,
    description: field.description,
    unit: field.unit,
    show_calculation: field.show_calculation,
    use_multiple_rounding: field.use_multiple_rounding,
    multiple_value: field.multiple_value,
    range_calculation: field.range_calculation,
    use_threshold_table: field.use_threshold_table,
    threshold_table_values: field.threshold_table_values,
  };

  if (field.use_result_rounding === false && !field.use_multiple_rounding) {
    payload.use_result_rounding = false;
    payload.rounding_type = field.rounding_type === 'significant' ? 'significant' : 'decimal';
    payload.rounding_decimal = field.rounding_decimal ?? 0;
  }

  return payload;
}

type FixtureTreeNode = NonNullable<TreeSelectProps['treeData']>[number];

interface CreateCalculationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (method: unknown) => void;
  laboratoryId?: number;
  departmentId?: number;
  laboratoryName?: string;
  departmentName?: string;
  /** Режим редактирования: ID метода для загрузки и замены (старый помечается удалённым, создаётся новая запись). */
  editMethodId?: number;
}

function methodToFormData(method: ResearchMethod) {
  const me = method.measurement_error;
  const hasRanges = Array.isArray(me?.ranges) && me.ranges.length > 0;
  const errorType: 'fixed' | 'formula' | 'range' = hasRanges
    ? 'range'
    : me?.type === 'formula'
      ? 'formula'
      : 'fixed';
  return {
    name: method.name,
    sample_type: Array.isArray(method.sample_type) ? method.sample_type : [],
    formula: method.formula ?? '',
    measurement_error: {
      type: errorType,
      value: me?.value ?? '',
      ranges: me?.ranges ?? [],
    },
    unit: method.unit ?? '',
    measurement_method: method.measurement_method ?? '',
    nd_code: method.nd_code ?? '',
    nd_name: method.nd_name ?? '',
    input_data: method.input_data ?? {
      fields: [{ name: '', description: '', unit: '', card_index: 1 }],
    },
    intermediate_data: {
      fields: (method.intermediate_data?.fields ?? []).map(f =>
        mapIntermediateFieldFromApi(f as IntermediateFieldForm & Record<string, unknown>)
      ),
    },
    convergence_conditions: method.convergence_conditions?.formulas?.length
      ? method.convergence_conditions
      : { formulas: [{ formula: '', convergence_value: 'satisfactory' }] },
    rounding_type: (method.rounding_type as 'decimal' | 'significant') ?? 'decimal',
    rounding_decimal: method.rounding_decimal ?? 0,
  };
}

/** Подпись пункта в дереве. */
function formatFixtureTreeTitle(fixture: FixtureData, fallbackKey: string): string {
  const methodName = fixture.name || fallbackKey;
  const isFractionalComposition = methodName.toLowerCase().startsWith('фракционный состав');
  const displayName =
    fixture.group_name && fixture.name && !isFractionalComposition
      ? `${fixture.group_name} ${fixture.name.charAt(0).toLowerCase()}${fixture.name.slice(1)}`
      : methodName;
  const ndCode = fixture.nd_code || '';
  return `${displayName} (${ndCode})`;
}

function formatSavedMethodTreeTitle(method: {
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

function savedLaboratoryKey(id: number | null): string {
  return id === null ? 'none' : String(id);
}

/** Корень дерева «лаборатория → подразделение → методы» для подстановки из базы. */
function buildSavedMethodsTreeRoot(data: SavedMethodsTreeResponse): FixtureTreeNode | null {
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

function updateFixtureTreeChildren(
  list: FixtureTreeNode[],
  key: React.Key,
  children: FixtureTreeNode[]
): FixtureTreeNode[] {
  return list.map(node => {
    if (node.key === key) {
      return { ...node, children };
    }
    if (node.children && node.children.length > 0) {
      return {
        ...node,
        children: updateFixtureTreeChildren(node.children as FixtureTreeNode[], key, children),
      };
    }
    return node;
  });
}

const CreateCalculationModal: React.FC<CreateCalculationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  laboratoryId,
  departmentId,
  laboratoryName,
  editMethodId,
}) => {
  const spinnerIndicator = <LoadingOutlined style={{ fontSize: 24, color: '#1677ff' }} spin />;

  const { options: catalogSampleTypeOptions, isLoading: isSampleTypeOptionsLoading } =
    useTestObjectSampleTypeOptions(laboratoryId, departmentId, isOpen);

  const isEditMode = editMethodId != null;
  const [activeTab, setActiveTab] = useState<'single' | 'group'>('single');
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoadingMethod, setIsLoadingMethod] = useState(false);
  const [loadedMethod, setLoadedMethod] = useState<ResearchMethod | null>(null);

  const [formData, setFormData] = useState<{
    name: string;
    sample_type: string[];
    formula: string;
    measurement_error: {
      type: 'fixed' | 'formula' | 'range';
      value: string;
      ranges: Array<{ formula: string; value: string }>;
    };
    unit: string;
    measurement_method: string;
    nd_code: string;
    nd_name: string;
    input_data: {
      fields: Array<{
        name: string;
        description: string;
        unit?: string;
        card_index: number;
      }>;
    };
    intermediate_data: {
      fields: IntermediateFieldForm[];
    };
    convergence_conditions: {
      formulas: Array<{
        formula: string;
        convergence_value: string;
        custom_value?: string;
      }>;
    };
    rounding_type: 'decimal' | 'significant';
    rounding_decimal: number;
  }>({
    name: '',
    sample_type: [],
    formula: '',
    measurement_error: {
      type: 'fixed',
      value: '',
      ranges: [],
    },
    unit: '',
    measurement_method: '',
    nd_code: '',
    nd_name: '',
    input_data: {
      fields: [{ name: '', description: '', unit: '', card_index: 1 }],
    },
    intermediate_data: {
      fields: [
        {
          name: '',
          formula: '',
          description: '',
          unit: '',
          show_calculation: true,
          use_multiple_rounding: false,
          multiple_value: '',
          use_result_rounding: true,
          rounding_type: 'decimal',
          rounding_decimal: 0,
        },
      ],
    },
    convergence_conditions: {
      formulas: [
        {
          formula: '',
          convergence_value: 'satisfactory',
        },
      ],
    },
    rounding_type: 'decimal',
    rounding_decimal: 0,
  });

  const sampleTypeOptions = catalogSampleTypeOptions;

  const catalogTagSet = useMemo(
    () => new Set(catalogSampleTypeOptions.map(option => option.value)),
    [catalogSampleTypeOptions]
  );

  useEffect(() => {
    if (!isOpen || isSampleTypeOptionsLoading) {
      return;
    }

    setFormData(prev => {
      const filteredSampleTypes = prev.sample_type.filter(tag => catalogTagSet.has(tag));
      if (filteredSampleTypes.length === prev.sample_type.length) {
        return prev;
      }
      return { ...prev, sample_type: filteredSampleTypes };
    });
  }, [isOpen, isSampleTypeOptionsLoading, catalogTagSet]);

  const [groupData, setGroupData] = useState<{
    name: string;
    selectedMethods: number[];
  }>({
    name: '',
    selectedMethods: [],
  });
  const [availableMethods, setAvailableMethods] = useState<{
    individual_methods: Array<{ id: number; name: string }>;
    groups: Array<{ id: number; name: string }>;
  }>({ individual_methods: [], groups: [] });
  const [isLoadingMethods, setIsLoadingMethods] = useState(false);

  const [fixtureTreeData, setFixtureTreeData] = useState<FixtureTreeNode[]>([]);
  const [selectedFixture, setSelectedFixture] = useState<string>('');
  const [isLoadingFixtures, setIsLoadingFixtures] = useState(false);

  const [activeFormulaField, setActiveFormulaField] = useState<string | null>(null);
  const formulaRefs = {
    main: useRef<InputRef>(null),
    convergence: useRef<(InputRef | null)[]>([]),
    intermediate: useRef<Record<number, Record<number, Record<string, InputRef | null>>>>({}),
    error: useRef<InputRef>(null),
    range: useRef<(InputRef | null)[]>([]),
    threshold: {} as Record<number, Record<string, InputRef | null>>,
  };

  const loadAvailableMethods = useCallback(async () => {
    try {
      setIsLoadingMethods(true);
      const response = await researchApi.getResearchMethods({
        laboratory_id: laboratoryId,
        department_id: departmentId,
        page_size: 100,
      });
      const individual_methods = response.items.filter(
        method => !method.is_group_member && (!method.groups || method.groups.length === 0)
      );
      setAvailableMethods({ individual_methods, groups: [] });
    } catch (err) {
      console.error('Ошибка при загрузке доступных методов:', err);
      message.error('Не удалось загрузить список доступных методов');
    } finally {
      setIsLoadingMethods(false);
    }
  }, [laboratoryId, departmentId]);

  const applyFixtureDataToForm = useCallback((fixtureData: FixtureData) => {
    setFormData({
      name: fixtureData.name || '',
      sample_type: Array.isArray(fixtureData.sample_type)
        ? fixtureData.sample_type
        : fixtureData.sample_type
          ? [fixtureData.sample_type]
          : [],
      formula: fixtureData.formula || '',
      measurement_error: {
        type: (fixtureData.measurement_error?.type || 'fixed') as 'fixed' | 'formula',
        value: fixtureData.measurement_error?.value || '',
        ranges: fixtureData.measurement_error?.ranges || [],
      },
      unit: fixtureData.unit || '',
      measurement_method: fixtureData.measurement_method || '',
      nd_code: fixtureData.nd_code || '',
      nd_name: fixtureData.nd_name || '',
      input_data: fixtureData.input_data || {
        fields: [{ name: '', description: '', unit: '', card_index: 1 }],
      },
      intermediate_data: {
        fields: fixtureData.intermediate_data?.fields
          ? fixtureData.intermediate_data.fields.map(field =>
              mapIntermediateFieldFromApi(field as IntermediateFieldForm & Record<string, unknown>)
            )
          : [
              {
                name: '',
                formula: '',
                description: '',
                unit: '',
                show_calculation: true,
                use_multiple_rounding: false,
                multiple_value: '',
                use_result_rounding: true,
                rounding_type: 'decimal' as const,
                rounding_decimal: 0,
              },
            ],
      },
      convergence_conditions: fixtureData.convergence_conditions || {
        formulas: [
          {
            formula: '',
            convergence_value: 'satisfactory',
          },
        ],
      },
      rounding_type: fixtureData.rounding_type || 'decimal',
      rounding_decimal: fixtureData.rounding_decimal || 0,
    });

    message.success('Поля заполнены по типовому описанию из справочника');
  }, []);

  const applyTemplateSelection = useCallback(
    async (rawValue: string | undefined) => {
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
          const fixtureData = await fixturesApi.getFixture(path);
          applyFixtureDataToForm(fixtureData);
        } catch (err) {
          console.error('Ошибка при загрузке типового описания:', err);
          message.error('Не удалось загрузить выбранный типовой метод из справочника');
        }
        return;
      }
      if (value.startsWith('method:')) {
        const id = parseInt(value.slice('method:'.length), 10);
        if (Number.isNaN(id)) {
          message.error('Некорректный идентификатор метода');
          return;
        }
        try {
          const method = await researchApi.getResearchMethod(id);
          setFormData(methodToFormData(method));
          message.success('Подставлены данные выбранного метода лаборатории');
        } catch (err) {
          console.error('Ошибка при загрузке метода:', err);
          message.error('Не удалось загрузить метод');
        }
      }
    },
    [applyFixtureDataToForm]
  );

  const loadFixtureFilesForDirectory = useCallback(
    async (dataNode: Parameters<NonNullable<TreeSelectProps['loadData']>>[0]) => {
      const keyStr = String(dataNode.key ?? '');
      if (!keyStr.startsWith('dir:')) {
        return;
      }
      if (dataNode.children && dataNode.children.length > 0) {
        return;
      }
      const dirPath = keyStr.slice('dir:'.length);
      const nodeKey = dataNode.key;
      if (nodeKey === undefined || nodeKey === null) {
        return;
      }
      try {
        const { files } = await fixturesApi.listFixtureFiles(dirPath);
        const children: FixtureTreeNode[] = await Promise.all(
          files.map(async fn => {
            const fullPath = `${dirPath}/${fn}`;
            const fallback = fn.replace(/\.json$/i, '');
            let title = fallback;
            try {
              const data = await fixturesApi.getFixture(fullPath);
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
        setFixtureTreeData(prev => updateFixtureTreeChildren(prev, nodeKey, children));
      } catch (err) {
        console.error(`Ошибка при загрузке списка методов раздела ${dirPath}:`, err);
        message.error('Не удалось загрузить список методов в выбранном разделе');
      }
    },
    []
  );

  const loadFixtureTemplateTree = useCallback(async () => {
    try {
      setIsLoadingFixtures(true);

      const savedData = await fixturesApi.getSavedMethodsTree();

      let directories: Awaited<
        ReturnType<typeof fixturesApi.getFixtureDirectories>
      >['directories'] = [];
      if (laboratoryName != null && laboratoryName.trim() !== '') {
        try {
          const dirResponse = await fixturesApi.getFixtureDirectories(laboratoryName);
          directories = dirResponse.directories;
        } catch (err) {
          console.error('Ошибка при загрузке разделов типового справочника:', err);
        }
      }

      const tree: FixtureTreeNode[] = [];

      if (directories.length > 0) {
        tree.push({
          title: 'Типовые методы расчёта по разделам',
          value: 'root-fixtures',
          key: 'root-fixtures',
          selectable: false,
          children: directories.map(d => ({
            title: d.label,
            value: `dir:${d.path}`,
            key: `dir:${d.path}`,
            selectable: false,
            isLeaf: false,
          })),
        });
      }

      const savedRoot = buildSavedMethodsTreeRoot(savedData);
      if (savedRoot) {
        tree.push(savedRoot);
      }

      setFixtureTreeData(tree);
    } catch (err) {
      console.error('Ошибка при построении справочника методов:', err);
      setFixtureTreeData([]);
      message.error('Не удалось загрузить справочник методов');
    } finally {
      setIsLoadingFixtures(false);
    }
  }, [laboratoryName]);

  const loadMethodForEdit = useCallback(async () => {
    if (editMethodId == null) return;
    try {
      setIsLoadingMethod(true);
      const method = await researchApi.getResearchMethod(editMethodId);
      setLoadedMethod(method);
      setFormData(methodToFormData(method));
    } catch (err) {
      console.error('Ошибка при загрузке метода:', err);
      message.error('Не удалось загрузить метод исследования');
    } finally {
      setIsLoadingMethod(false);
    }
  }, [editMethodId]);

  useEffect(() => {
    if (!isOpen) {
      setLoadedMethod(null);
      setFixtureTreeData([]);
      setSelectedFixture('');
      return;
    }
    if (isEditMode && editMethodId != null) {
      loadMethodForEdit();
      return;
    }
    if (activeTab === 'group') {
      loadAvailableMethods();
    } else {
      loadFixtureTemplateTree();
    }
  }, [
    isOpen,
    isEditMode,
    editMethodId,
    activeTab,
    loadMethodForEdit,
    loadAvailableMethods,
    loadFixtureTemplateTree,
  ]);

  const handleGroupDataChange = (field: string, value: unknown) => {
    setGroupData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSampleTypeChange = (checkedValues: string[]) => {
    setFormData(prev => ({
      ...prev,
      sample_type: checkedValues,
    }));
  };

  const handleInputDataChange = (index: number, field: string, value: unknown) => {
    setFormData(prevData => {
      const newInputData = [...prevData.input_data.fields];
      newInputData[index] = {
        ...newInputData[index],
        [field]: value,
      };
      return {
        ...prevData,
        input_data: {
          ...prevData.input_data,
          fields: newInputData,
        },
      };
    });
  };

  const handleIntermediateDataChange = (index: number, field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      intermediate_data: {
        ...prev.intermediate_data,
        fields: prev.intermediate_data.fields.map((item, i) =>
          i === index ? { ...item, [field]: value } : item
        ),
      },
    }));
  };

  const getIntermediateRoundingMode = (
    field: IntermediateFieldForm
  ): 'result' | 'custom' | 'multiple' => {
    if (field.use_multiple_rounding) {
      return 'multiple';
    }
    if (field.use_result_rounding === false) {
      return 'custom';
    }
    return 'result';
  };

  const applyIntermediateRoundingMode = (index: number, mode: 'result' | 'custom' | 'multiple') => {
    setFormData(prev => {
      const fields = [...prev.intermediate_data.fields];
      const field = { ...fields[index] };

      if (mode === 'multiple') {
        field.use_multiple_rounding = true;
        field.use_result_rounding = true;
        field.rounding_type = 'multiple';
        if (!field.multiple_value) {
          field.multiple_value = '10';
        }
      } else {
        field.use_multiple_rounding = false;
        field.use_result_rounding = mode === 'result';
        if (mode === 'custom') {
          field.rounding_type =
            field.rounding_type === 'multiple' || !field.rounding_type
              ? 'decimal'
              : field.rounding_type;
          field.rounding_decimal = field.rounding_decimal ?? 0;
        }
      }

      fields[index] = field;
      return {
        ...prev,
        intermediate_data: {
          ...prev.intermediate_data,
          fields,
        },
      };
    });
  };

  const handleConvergenceChange = (index: number, field: string, value: unknown) => {
    const updatedData = { ...formData };
    if (!updatedData.convergence_conditions) {
      updatedData.convergence_conditions = { formulas: [] };
    }
    if (!updatedData.convergence_conditions.formulas[index]) {
      updatedData.convergence_conditions.formulas[index] = {
        formula: '',
        convergence_value: 'satisfactory',
      };
    }
    updatedData.convergence_conditions.formulas[index] = {
      ...updatedData.convergence_conditions.formulas[index],
      [field]: value,
    };

    if (field === 'convergence_value' && value !== 'custom') {
      delete updatedData.convergence_conditions.formulas[index].custom_value;
    }

    setFormData(updatedData);
  };

  const deleteInputField = (indexToDelete: number) => {
    setFormData(prev => ({
      ...prev,
      input_data: {
        fields: prev.input_data.fields.filter((_, index) => index !== indexToDelete),
      },
    }));
  };

  const deleteIntermediateField = (indexToDelete: number) => {
    setFormData(prev => ({
      ...prev,
      intermediate_data: {
        fields: prev.intermediate_data.fields.filter((_, index) => index !== indexToDelete),
      },
    }));
  };

  const addInputField = () => {
    setFormData(prevData => ({
      ...prevData,
      input_data: {
        ...prevData.input_data,
        fields: [
          ...prevData.input_data.fields,
          {
            name: '',
            description: '',
            card_index: 1,
          },
        ],
      },
    }));
  };

  const addIntermediateField = () => {
    setFormData(prev => ({
      ...prev,
      intermediate_data: {
        ...prev.intermediate_data,
        fields: [
          ...prev.intermediate_data.fields,
          {
            name: '',
            formula: '',
            description: '',
            unit: '',
            show_calculation: true,
            use_multiple_rounding: false,
            multiple_value: '',
            use_result_rounding: true,
            rounding_type: 'decimal',
            rounding_decimal: 0,
          },
        ],
      },
    }));
  };

  const handleIntermediateRangeChange = (
    fieldIndex: number,
    rangeIndex: number,
    key: string,
    value: string
  ) => {
    setFormData(prev => {
      const fields = [...prev.intermediate_data.fields];
      const field = { ...fields[fieldIndex] };

      if (!field.range_calculation) {
        field.range_calculation = { ranges: [] };
      }

      const ranges = [...field.range_calculation.ranges];
      ranges[rangeIndex] = { ...ranges[rangeIndex], [key]: value };

      field.range_calculation.ranges = ranges;
      fields[fieldIndex] = field;

      return {
        ...prev,
        intermediate_data: {
          ...prev.intermediate_data,
          fields,
        },
      };
    });
  };

  const addIntermediateRange = (fieldIndex: number) => {
    setFormData(prev => {
      const fields = [...prev.intermediate_data.fields];
      const field = { ...fields[fieldIndex] };

      if (!field.range_calculation) {
        field.range_calculation = { ranges: [] };
      }

      field.range_calculation.ranges = [
        ...(field.range_calculation.ranges || []),
        { condition: '', formula: '' },
      ];

      fields[fieldIndex] = field;

      return {
        ...prev,
        intermediate_data: {
          ...prev.intermediate_data,
          fields,
        },
      };
    });
  };

  const deleteIntermediateRange = (fieldIndex: number, rangeIndex: number) => {
    setFormData(prev => {
      const fields = [...prev.intermediate_data.fields];
      const field = { ...fields[fieldIndex] };

      if (field.range_calculation && field.range_calculation.ranges) {
        field.range_calculation.ranges = field.range_calculation.ranges.filter(
          (_, index) => index !== rangeIndex
        );

        if (field.range_calculation.ranges.length === 0) {
          delete field.range_calculation;
        }
      }

      fields[fieldIndex] = field;

      return {
        ...prev,
        intermediate_data: {
          ...prev.intermediate_data,
          fields,
        },
      };
    });
  };

  const addConvergenceCondition = () => {
    setFormData(prev => ({
      ...prev,
      convergence_conditions: {
        formulas: [
          ...prev.convergence_conditions.formulas,
          {
            formula: '',
            convergence_value: 'satisfactory',
          },
        ],
      },
    }));
  };

  const deleteConvergenceCondition = (indexToDelete: number) => {
    setFormData(prev => ({
      ...prev,
      convergence_conditions: {
        formulas: prev.convergence_conditions.formulas.filter(
          (_, index) => index !== indexToDelete
        ),
      },
    }));
  };

  const handleFormulaKeyPress = (value: string) => {
    if (!activeFormulaField) return;

    const parts = activeFormulaField.split('-');
    const type = parts[0];
    const index = parts[1] ? parseInt(parts[1]) : null;
    const rangeIndex = parts[2] ? parseInt(parts[2]) : null;
    const field = parts[3];

    if (
      type === 'intermediate' &&
      rangeIndex !== undefined &&
      rangeIndex !== null &&
      field &&
      index !== null &&
      index !== undefined
    ) {
      const fieldIndex = index;
      const rangeIdx = rangeIndex;
      const refObj = formulaRefs.intermediate.current[fieldIndex] as Record<
        number,
        Record<string, InputRef | null>
      > | null;
      if (!refObj || !refObj[rangeIdx] || !refObj[rangeIdx][field]) return;
      const inputRef = refObj[rangeIdx][field];
      if (!inputRef || !inputRef.input) return;
      const input = inputRef.input;

      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;

      if (value === 'backspace') {
        if (start !== end) {
          const newValue = input.value.substring(0, start) + input.value.substring(end);
          handleIntermediateRangeChange(fieldIndex, rangeIdx, field, newValue);
          setTimeout(() => {
            input.selectionStart = input.selectionEnd = start;
            input.focus();
          }, 0);
        } else if (start > 0) {
          const newValue = input.value.substring(0, start - 1) + input.value.substring(end);
          handleIntermediateRangeChange(fieldIndex, rangeIdx, field, newValue);
          setTimeout(() => {
            input.selectionStart = input.selectionEnd = start - 1;
            input.focus();
          }, 0);
        }
      } else {
        const newValue = input.value.substring(0, start) + value + input.value.substring(end);
        handleIntermediateRangeChange(fieldIndex, rangeIdx, field, newValue);
        setTimeout(() => {
          input.selectionStart = input.selectionEnd = start + value.length;
          input.focus();
        }, 0);
      }
      return;
    }

    if (type === 'main' && formulaRefs.main.current?.input) {
      const input = formulaRefs.main.current.input;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;

      if (value === 'backspace') {
        if (start !== end) {
          const newValue = input.value.substring(0, start) + input.value.substring(end);
          setFormData(prev => ({ ...prev, formula: newValue }));
          setTimeout(() => {
            input.selectionStart = input.selectionEnd = start;
            input.focus();
          }, 0);
        } else if (start > 0) {
          const newValue = input.value.substring(0, start - 1) + input.value.substring(end);
          setFormData(prev => ({ ...prev, formula: newValue }));
          setTimeout(() => {
            input.selectionStart = input.selectionEnd = start - 1;
            input.focus();
          }, 0);
        }
      } else {
        const newValue = input.value.substring(0, start) + value + input.value.substring(end);
        setFormData(prev => ({ ...prev, formula: newValue }));
        setTimeout(() => {
          input.selectionStart = input.selectionEnd = start + value.length;
          input.focus();
        }, 0);
      }
    } else if (type === 'error' && formulaRefs.error.current?.input) {
      const input = formulaRefs.error.current.input;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;

      if (value === 'backspace') {
        if (start !== end) {
          const newValue = input.value.substring(0, start) + input.value.substring(end);
          setFormData(prev => ({
            ...prev,
            measurement_error: {
              ...prev.measurement_error,
              value: newValue,
            },
          }));
          setTimeout(() => {
            input.selectionStart = input.selectionEnd = start;
            input.focus();
          }, 0);
        } else if (start > 0) {
          const newValue = input.value.substring(0, start - 1) + input.value.substring(end);
          setFormData(prev => ({
            ...prev,
            measurement_error: {
              ...prev.measurement_error,
              value: newValue,
            },
          }));
          setTimeout(() => {
            input.selectionStart = input.selectionEnd = start - 1;
            input.focus();
          }, 0);
        }
      } else {
        const newValue = input.value.substring(0, start) + value + input.value.substring(end);
        setFormData(prev => ({
          ...prev,
          measurement_error: {
            ...prev.measurement_error,
            value: newValue,
          },
        }));
        setTimeout(() => {
          input.selectionStart = input.selectionEnd = start + value.length;
          input.focus();
        }, 0);
      }
    } else if (
      type === 'convergence' &&
      index !== null &&
      index !== undefined &&
      formulaRefs.convergence.current[index]
    ) {
      const formulas = [...formData.convergence_conditions.formulas];
      const inputRef = formulaRefs.convergence.current[index];
      const input = inputRef?.input;
      if (!input) return;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;

      if (value === 'backspace') {
        if (start !== end) {
          const newValue = input.value.substring(0, start) + input.value.substring(end);
          formulas[index] = { ...formulas[index], formula: newValue };
          setFormData(prev => ({
            ...prev,
            convergence_conditions: { formulas },
          }));
          setTimeout(() => {
            input.selectionStart = input.selectionEnd = start;
            input.focus();
          }, 0);
        } else if (start > 0) {
          const newValue = input.value.substring(0, start - 1) + input.value.substring(end);
          formulas[index] = { ...formulas[index], formula: newValue };
          setFormData(prev => ({
            ...prev,
            convergence_conditions: { formulas },
          }));
          setTimeout(() => {
            input.selectionStart = input.selectionEnd = start - 1;
            input.focus();
          }, 0);
        }
      } else {
        const newValue = input.value.substring(0, start) + value + input.value.substring(end);
        formulas[index] = { ...formulas[index], formula: newValue };
        setFormData(prev => ({
          ...prev,
          convergence_conditions: { formulas },
        }));
        setTimeout(() => {
          input.selectionStart = input.selectionEnd = start + value.length;
          input.focus();
        }, 0);
      }
    } else if (
      type === 'intermediate' &&
      index !== null &&
      index !== undefined &&
      formulaRefs.intermediate.current[index] &&
      formulaRefs.intermediate.current[index][-1]?.formula
    ) {
      const fields = [...formData.intermediate_data.fields];
      const inputRef = formulaRefs.intermediate.current[index][-1]?.formula;
      if (!inputRef?.input) return;
      const input = inputRef.input;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;

      if (value === 'backspace') {
        if (start !== end) {
          const newValue = input.value.substring(0, start) + input.value.substring(end);
          fields[index] = { ...fields[index], formula: newValue };
          setFormData(prev => ({
            ...prev,
            intermediate_data: { fields },
          }));
          setTimeout(() => {
            input.selectionStart = input.selectionEnd = start;
            input.focus();
          }, 0);
        } else if (start > 0) {
          const newValue = input.value.substring(0, start - 1) + input.value.substring(end);
          fields[index] = { ...fields[index], formula: newValue };
          setFormData(prev => ({
            ...prev,
            intermediate_data: { fields },
          }));
          setTimeout(() => {
            input.selectionStart = input.selectionEnd = start - 1;
            input.focus();
          }, 0);
        }
      } else {
        const newValue = input.value.substring(0, start) + value + input.value.substring(end);
        fields[index] = { ...fields[index], formula: newValue };
        setFormData(prev => ({
          ...prev,
          intermediate_data: { fields },
        }));
        setTimeout(() => {
          input.selectionStart = input.selectionEnd = start + value.length;
          input.focus();
        }, 0);
      }
    } else if (
      type === 'range' &&
      index !== null &&
      index !== undefined &&
      formulaRefs.range.current[index]
    ) {
      const inputRef = formulaRefs.range.current[index];
      const input = inputRef?.input;
      if (!input) return;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;

      if (value === 'backspace') {
        if (start !== end) {
          const newValue = input.value.substring(0, start) + input.value.substring(end);
          handleMeasurementErrorRangeChange(index, 'formula', newValue);
          setTimeout(() => {
            input.selectionStart = input.selectionEnd = start;
            input.focus();
          }, 0);
        } else if (start > 0) {
          const newValue = input.value.substring(0, start - 1) + input.value.substring(end);
          handleMeasurementErrorRangeChange(index, 'formula', newValue);
          setTimeout(() => {
            input.selectionStart = input.selectionEnd = start - 1;
            input.focus();
          }, 0);
        }
      } else {
        const newValue = input.value.substring(0, start) + value + input.value.substring(end);
        handleMeasurementErrorRangeChange(index, 'formula', newValue);
        setTimeout(() => {
          input.selectionStart = input.selectionEnd = start + value.length;
          input.focus();
        }, 0);
      }
    }
  };

  const inputVariables = formData.input_data.fields
    .map(field => field.name)
    .filter(name => name.trim() !== '');

  const getAvailableVariables = (type: string, currentIndex: number | null = null): string[] => {
    const intermediateVariables = formData.intermediate_data.fields
      .map(field => field.name)
      .filter(name => name.trim() !== '');

    if (type === 'main' || type === 'convergence' || type === 'error' || type === 'range') {
      return [...inputVariables, ...intermediateVariables];
    }

    if (type === 'intermediate' && currentIndex !== null) {
      const previousIntermediateVars = intermediateVariables.slice(0, currentIndex);
      return [...inputVariables, ...previousIntermediateVars];
    }

    return inputVariables;
  };

  const renderFormulaInput = (
    value: string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    type: string,
    index: number | null = null,
    placeholder = ''
  ) => (
    <div className="formula-input-container">
      <Input
        value={value}
        onChange={onChange}
        onFocus={() => setActiveFormulaField(`${type}-${index ?? 'main'}`)}
        onBlur={() => {
          setTimeout(() => {
            setActiveFormulaField(null);
          }, 200);
        }}
        onKeyDown={e => {
          if (
            e.key === 'Backspace' ||
            e.key === 'Delete' ||
            e.key === 'ArrowLeft' ||
            e.key === 'ArrowRight' ||
            ((e.ctrlKey || e.metaKey) && ['c', 'v', 'a', 'x'].includes(e.key.toLowerCase()))
          ) {
            return;
          }
          e.preventDefault();
        }}
        ref={el => {
          if (type === 'main') formulaRefs.main.current = el;
          else if (type === 'convergence' && index !== null)
            formulaRefs.convergence.current[index] = el;
          else if (type === 'intermediate' && index !== null) {
            if (!formulaRefs.intermediate.current[index]) {
              formulaRefs.intermediate.current[index] = {};
            }
            if (!formulaRefs.intermediate.current[index][-1]) {
              formulaRefs.intermediate.current[index][-1] = {};
            }
            formulaRefs.intermediate.current[index][-1].formula = el;
          } else if (type === 'error') formulaRefs.error.current = el;
          else if (type === 'range' && index !== null) formulaRefs.range.current[index] = el;
        }}
        placeholder={placeholder}
      />
      {activeFormulaField === `${type}-${index ?? 'main'}` && (
        <div onMouseDown={e => e.preventDefault()}>
          <FormulaKeyboard
            onKeyPress={handleFormulaKeyPress}
            variables={getAvailableVariables(type, index)}
          />
        </div>
      )}
    </div>
  );

  const handleMeasurementErrorTypeChange = (type: 'fixed' | 'formula' | 'range') => {
    setFormData(prev => ({
      ...prev,
      measurement_error: {
        type,
        value: '',
        ranges: [],
      },
    }));
  };

  const handleMeasurementErrorValueChange = (
    value: string | React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      measurement_error: {
        ...prev.measurement_error,
        value: typeof value === 'object' ? value.target.value : value,
      },
    }));
  };

  const handleMeasurementErrorRangeChange = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      measurement_error: {
        ...prev.measurement_error,
        ranges: prev.measurement_error.ranges.map((range, i) =>
          i === index ? { ...range, [field]: value } : range
        ),
      },
    }));
  };

  const buildCreatePayload = (): ResearchMethodCreate => ({
    name: formData.name,
    sample_type: formData.sample_type.filter(tag => catalogTagSet.has(tag)),
    formula: formData.formula,
    measurement_error: {
      type: formData.measurement_error.type === 'range' ? 'fixed' : formData.measurement_error.type,
      value: formData.measurement_error.value,
    },
    unit: formData.unit,
    measurement_method: formData.measurement_method,
    nd_code: formData.nd_code,
    nd_name: formData.nd_name,
    input_data: formData.input_data,
    intermediate_data: {
      fields: formData.intermediate_data.fields.map(serializeIntermediateFieldForApi),
    },
    convergence_conditions:
      formData.convergence_conditions.formulas.length > 0 &&
      formData.convergence_conditions.formulas[0].formula
        ? formData.convergence_conditions
        : {
            formulas: [
              {
                formula: '',
                convergence_value: 'satisfactory',
              },
            ],
          },
    rounding_type: formData.rounding_type,
    rounding_decimal: formData.rounding_decimal,
    laboratory_id: laboratoryId,
    department_id: departmentId,
  });

  const handleSubmit = async () => {
    try {
      if (isEditMode && loadedMethod) {
        if (!formData.name.trim()) {
          message.error('Введите название формулы');
          return;
        }
        if (formData.sample_type.length === 0) {
          message.error('Выберите хотя бы один тип пробы');
          return;
        }
        const groupId = loadedMethod.groups?.[0]?.id;
        let groupMethodIds: number[] | null = null;
        if (groupId != null) {
          const group = await researchApi.getResearchMethodGroup(groupId);
          groupMethodIds = group.methods.map(m => m.id);
        }
        await researchApi.deleteResearchMethod(editMethodId!);
        const dataToSend: ResearchMethodCreate = {
          ...buildCreatePayload(),
          sort_order: loadedMethod.sort_order ?? undefined,
          equipment_data_default: loadedMethod.equipment_data_default ?? undefined,
          laboratory_id: loadedMethod.laboratory_id ?? laboratoryId,
          department_id: loadedMethod.department_id ?? departmentId,
          is_group_member: false,
        };
        const response = await researchApi.createResearchMethod(dataToSend);
        if (groupId != null && groupMethodIds != null) {
          const newMethodIds = groupMethodIds.map(id => (id === editMethodId ? response.id : id));
          await researchApi.updateResearchMethodGroup(groupId, { method_ids: newMethodIds });
        }
        message.success('Метод исследования успешно обновлён');
        onSuccess?.(response);
        onClose();
        return;
      }

      if (activeTab === 'group') {
        if (!groupData.name.trim()) {
          message.error('Введите название группы');
          return;
        }
        if (groupData.selectedMethods.length === 0) {
          message.error('Выберите хотя бы один метод для группы');
          return;
        }

        const groupResponse = await researchApi.createResearchMethodGroup({
          name: groupData.name,
          method_ids: groupData.selectedMethods,
        });

        if (groupResponse) {
          message.success('Группа методов успешно добавлена');
          onSuccess?.(groupResponse);
          onClose();
        }
      } else {
        if (!formData.name.trim()) {
          message.error('Введите название формулы');
          return;
        }

        if (formData.sample_type.length === 0) {
          message.error('Выберите хотя бы один тип пробы');
          return;
        }

        const dataToSend = buildCreatePayload();
        const response = await researchApi.createResearchMethod(dataToSend);

        if (response) {
          message.success('Метод исследования успешно добавлен');
          onSuccess?.(response);
          onClose();
        }
      }
    } catch (err: unknown) {
      console.error('Ошибка при сохранении:', err);
      const errorMessage =
        (err as { response?: { data?: { detail?: string; message?: string } } })?.response?.data
          ?.detail ||
        (err as { response?: { data?: { detail?: string; message?: string } } })?.response?.data
          ?.message ||
        'Произошла ошибка при сохранении';
      message.error(errorMessage);
    }
  };

  const handleTabChange = (tab: 'single' | 'group') => {
    if (tab !== activeTab) {
      setIsAnimating(true);
      if (tab === 'group') {
        setFormData({
          name: '',
          sample_type: [],
          formula: '',
          measurement_error: {
            type: 'fixed',
            value: '',
            ranges: [],
          },
          unit: '',
          measurement_method: '',
          nd_code: '',
          nd_name: '',
          input_data: {
            fields: [{ name: '', description: '', unit: '', card_index: 1 }],
          },
          intermediate_data: {
            fields: [
              {
                name: '',
                formula: '',
                description: '',
                unit: '',
                show_calculation: true,
                use_multiple_rounding: false,
                multiple_value: '',
                use_result_rounding: true,
                rounding_type: 'decimal',
                rounding_decimal: 0,
              },
            ],
          },
          convergence_conditions: {
            formulas: [
              {
                formula: '',
                convergence_value: 'satisfactory',
              },
            ],
          },
          rounding_type: 'decimal',
          rounding_decimal: 0,
        });
      } else {
        setGroupData({
          name: '',
          selectedMethods: [],
        });
      }

      setTimeout(() => {
        setActiveTab(tab);
        setTimeout(() => {
          setIsAnimating(false);
        }, 50);
      }, 300);
    }
  };

  if (!isOpen) return null;

  const showSingleForm = isEditMode || activeTab === 'single';

  return (
    <Modal
      header={isEditMode ? 'Редактирование метода исследования' : 'Добавление метода исследования'}
      onClose={onClose}
      onCancel={onClose}
      onSave={handleSubmit}
      modalWidth="1000"
      saveButtonText="Сохранить"
    >
      <div className="add-calculation-form">
        {!isEditMode && (
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'single' ? 'active' : ''}`}
              onClick={() => handleTabChange('single')}
              type="button"
            >
              Одиночный метод
            </button>
            <button
              className={`tab ${activeTab === 'group' ? 'active' : ''}`}
              onClick={() => handleTabChange('group')}
              type="button"
            >
              Группированный метод
            </button>
          </div>
        )}

        {showSingleForm && !isEditMode && (
          <div className="method-prefill-section">
            <div className="form-group">
              <label>Готовые конфигурации</label>
              <div className="method-prefill-controls">
                {isLoadingFixtures ? (
                  <div className="loading-text create-calculation-spinner">
                    <Spin tip="Загрузка справочника..." indicator={spinnerIndicator} spinning>
                      <div className="create-calculation-spinner-placeholder" />
                    </Spin>
                  </div>
                ) : fixtureTreeData.length > 0 ? (
                  <TreeSelect
                    className="method-prefill-tree-select"
                    showSearch
                    treeNodeFilterProp="title"
                    placeholder="Выберите, чтобы подставить готовую конфигурацию"
                    allowClear
                    listHeight={350}
                    treeData={fixtureTreeData}
                    loadData={loadFixtureFilesForDirectory}
                    value={selectedFixture || undefined}
                    onChange={value => {
                      void applyTemplateSelection(typeof value === 'string' ? value : undefined);
                    }}
                    disabled={isLoadingFixtures}
                  />
                ) : (
                  <div className="loading-text">
                    Нет готовых конфигураций — заполните форму ниже вручную
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div
          className={`modal-content-wrapper ${isEditMode || activeTab === 'single' ? 'single-content' : 'group-content'}`}
        >
          <div className={`tab-content ${isAnimating ? 'entering' : ''}`}>
            {isEditMode && isLoadingMethod ? (
              <div className="loading-text create-calculation-spinner">
                <Spin tip="Загрузка метода..." indicator={spinnerIndicator} spinning>
                  <div className="create-calculation-spinner-placeholder" />
                </Spin>
              </div>
            ) : activeTab === 'group' && !isEditMode ? (
              <>
                <div className="form-group">
                  <label>Название группы</label>
                  <Input
                    value={groupData.name}
                    onChange={e => setGroupData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Введите название группы"
                  />
                </div>

                <div className="form-group">
                  <label>Выберите методы для группы</label>
                  {isLoadingMethods ? (
                    <div className="loading-text create-calculation-spinner">
                      <Spin tip="Загрузка методов..." indicator={spinnerIndicator} spinning>
                        <div className="create-calculation-spinner-placeholder" />
                      </Spin>
                    </div>
                  ) : (
                    <div className="methods-list">
                      {availableMethods.individual_methods.map(method => (
                        <Checkbox
                          key={method.id}
                          checked={groupData.selectedMethods.includes(method.id)}
                          onChange={e => {
                            const newSelectedMethods = e.target.checked
                              ? [...groupData.selectedMethods, method.id]
                              : groupData.selectedMethods.filter(id => id !== method.id);
                            handleGroupDataChange('selectedMethods', newSelectedMethods);
                          }}
                        >
                          {method.name}
                        </Checkbox>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label>Название формулы</label>
                  <Input
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Введите название формулы"
                  />
                </div>

                <div className="form-group">
                  <label>Типы проб</label>
                  {isSampleTypeOptionsLoading ? (
                    <Spin indicator={spinnerIndicator} />
                  ) : sampleTypeOptions.length === 0 ? (
                    <p className="sample-types-empty-hint">
                      Нет объектов испытаний в справочнике для выбранной лаборатории.
                    </p>
                  ) : null}
                  <div className="sample-types-controls">
                    <button
                      type="button"
                      className="select-all-btn"
                      onClick={() =>
                        handleSampleTypeChange(sampleTypeOptions.map(opt => opt.value))
                      }
                    >
                      Выбрать все
                    </button>
                    <button
                      type="button"
                      className="clear-all-btn"
                      onClick={() => handleSampleTypeChange([])}
                    >
                      Очистить все
                    </button>
                  </div>
                  <div className="sample-types-container">
                    {sampleTypeOptions.map(option => (
                      <Checkbox
                        key={option.value}
                        checked={formData.sample_type.includes(option.value)}
                        onChange={e => {
                          if (e.target.checked) {
                            handleSampleTypeChange([...formData.sample_type, option.value]);
                          } else {
                            handleSampleTypeChange(
                              formData.sample_type.filter(type => type !== option.value)
                            );
                          }
                        }}
                      >
                        {option.label}
                      </Checkbox>
                    ))}
                  </div>
                </div>

                <div className="form-section">
                  <h3>Входные данные</h3>
                  {formData.input_data.fields.map((field, index) => (
                    <div key={index} className="field-group">
                      <button
                        type="button"
                        className="delete-field-btn"
                        onClick={() => deleteInputField(index)}
                      >
                        ×
                      </button>
                      <div className="form-group">
                        <label>Название переменной</label>
                        <Input
                          value={field.name}
                          onChange={e => handleInputDataChange(index, 'name', e.target.value)}
                          placeholder="Введите название переменной"
                        />
                      </div>
                      <div className="form-group">
                        <label>Описание</label>
                        <Input
                          value={field.description}
                          onChange={e =>
                            handleInputDataChange(index, 'description', e.target.value)
                          }
                          placeholder="Введите описание"
                        />
                      </div>
                      <div className="form-group">
                        <label>Единица измерения</label>
                        <Input
                          value={field.unit || ''}
                          onChange={e => handleInputDataChange(index, 'unit', e.target.value)}
                          placeholder="Введите единицу измерения"
                        />
                      </div>
                      <div className="form-group">
                        <label>Номер карточки</label>
                        <Select
                          value={field.card_index}
                          onChange={value => handleInputDataChange(index, 'card_index', value)}
                          placeholder="Выберите номер карточки"
                          listHeight={100}
                        >
                          <Option value={1}>Карточка 1</Option>
                          <Option value={2}>Карточка 2</Option>
                          <Option value={3}>Карточка 3</Option>
                          <Option value={4}>Карточка 4</Option>
                          <Option value={5}>Карточка 5</Option>
                          <Option value={6}>Карточка 6</Option>
                          <Option value={7}>Карточка 7</Option>
                          <Option value={8}>Карточка 8</Option>
                        </Select>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addInputField} className="add-field-btn">
                    + Добавить переменную
                  </button>
                </div>

                <div className="form-section">
                  <h3>Промежуточные вычисления</h3>
                  {formData.intermediate_data.fields.map((field, index) => (
                    <div key={index} className="field-group">
                      <button
                        type="button"
                        className="delete-field-btn"
                        onClick={() => deleteIntermediateField(index)}
                      >
                        ×
                      </button>
                      <div className="form-group">
                        <label>Название переменной</label>
                        <Input
                          value={field.name}
                          onChange={e =>
                            handleIntermediateDataChange(index, 'name', e.target.value)
                          }
                          placeholder="Введите название"
                        />
                      </div>

                      <div className="range-calculation-section">
                        <div className="range-header">
                          <Checkbox
                            checked={!!field.range_calculation}
                            onChange={e => {
                              if (e.target.checked) {
                                handleIntermediateDataChange(index, 'range_calculation', {
                                  ranges: [{ condition: '', formula: '' }],
                                });
                                handleIntermediateDataChange(index, 'formula', '');
                                handleIntermediateDataChange(index, 'use_threshold_table', false);
                              } else {
                                handleIntermediateDataChange(index, 'range_calculation', null);
                              }
                            }}
                          >
                            Использовать диапазонный расчет
                          </Checkbox>
                        </div>

                        {!field.range_calculation && !field.use_threshold_table && (
                          <div className="form-group">
                            <label>Формула</label>
                            {renderFormulaInput(
                              field.formula,
                              e => handleIntermediateDataChange(index, 'formula', e.target.value),
                              'intermediate',
                              index
                            )}
                          </div>
                        )}

                        {field.range_calculation && (
                          <div className="ranges-container">
                            {field.range_calculation.ranges.map((range, rangeIndex) => (
                              <div key={rangeIndex} className="range-item">
                                <button
                                  type="button"
                                  className="delete-range-btn"
                                  onClick={() => deleteIntermediateRange(index, rangeIndex)}
                                >
                                  ×
                                </button>
                                <div className="form-group">
                                  <label>Условие диапазона</label>
                                  <div className="formula-input-container">
                                    <Input
                                      value={range.condition}
                                      onChange={e =>
                                        handleIntermediateRangeChange(
                                          index,
                                          rangeIndex,
                                          'condition',
                                          e.target.value
                                        )
                                      }
                                      onFocus={() =>
                                        setActiveFormulaField(
                                          `intermediate-${index}-${rangeIndex}-condition`
                                        )
                                      }
                                      onBlur={() => {
                                        setTimeout(() => {
                                          setActiveFormulaField(null);
                                        }, 200);
                                      }}
                                      onKeyDown={e => {
                                        if (
                                          e.key === 'Backspace' ||
                                          e.key === 'Delete' ||
                                          e.key === 'ArrowLeft' ||
                                          e.key === 'ArrowRight' ||
                                          ((e.ctrlKey || e.metaKey) &&
                                            ['c', 'v', 'a', 'x'].includes(e.key.toLowerCase()))
                                        ) {
                                          return;
                                        }
                                        e.preventDefault();
                                      }}
                                      ref={el => {
                                        if (!formulaRefs.intermediate.current[index]) {
                                          formulaRefs.intermediate.current[index] = {};
                                        }
                                        if (!formulaRefs.intermediate.current[index][rangeIndex]) {
                                          formulaRefs.intermediate.current[index][rangeIndex] = {};
                                        }
                                        if (formulaRefs.intermediate.current[index][rangeIndex]) {
                                          formulaRefs.intermediate.current[index][
                                            rangeIndex
                                          ].condition = el;
                                        }
                                      }}
                                      placeholder="Введите условие"
                                    />
                                    {activeFormulaField ===
                                      `intermediate-${index}-${rangeIndex}-condition` && (
                                      <div onMouseDown={e => e.preventDefault()}>
                                        <FormulaKeyboard
                                          onKeyPress={handleFormulaKeyPress}
                                          variables={getAvailableVariables('intermediate', index)}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="form-group">
                                  <label>Формула расчета</label>
                                  <div className="formula-input-container">
                                    <Input
                                      value={range.formula}
                                      onChange={e =>
                                        handleIntermediateRangeChange(
                                          index,
                                          rangeIndex,
                                          'formula',
                                          e.target.value
                                        )
                                      }
                                      onFocus={() =>
                                        setActiveFormulaField(
                                          `intermediate-${index}-${rangeIndex}-formula`
                                        )
                                      }
                                      onBlur={() => {
                                        setTimeout(() => {
                                          setActiveFormulaField(null);
                                        }, 200);
                                      }}
                                      onKeyDown={e => {
                                        if (
                                          e.key === 'Backspace' ||
                                          e.key === 'Delete' ||
                                          e.key === 'ArrowLeft' ||
                                          e.key === 'ArrowRight' ||
                                          ((e.ctrlKey || e.metaKey) &&
                                            ['c', 'v', 'a', 'x'].includes(e.key.toLowerCase()))
                                        ) {
                                          return;
                                        }
                                        e.preventDefault();
                                      }}
                                      ref={el => {
                                        if (!formulaRefs.intermediate.current[index]) {
                                          formulaRefs.intermediate.current[index] = {};
                                        }
                                        if (!formulaRefs.intermediate.current[index][rangeIndex]) {
                                          formulaRefs.intermediate.current[index][rangeIndex] = {};
                                        }
                                        if (formulaRefs.intermediate.current[index][rangeIndex]) {
                                          formulaRefs.intermediate.current[index][
                                            rangeIndex
                                          ].formula = el;
                                        }
                                      }}
                                      placeholder="Введите формулу расчета"
                                    />
                                    {activeFormulaField ===
                                      `intermediate-${index}-${rangeIndex}-formula` && (
                                      <div onMouseDown={e => e.preventDefault()}>
                                        <FormulaKeyboard
                                          onKeyPress={handleFormulaKeyPress}
                                          variables={getAvailableVariables('intermediate', index)}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => addIntermediateRange(index)}
                              className="add-range-btn"
                            >
                              + Добавить диапазон
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="form-group">
                        <label>Описание</label>
                        <Input
                          value={field.description}
                          onChange={e =>
                            handleIntermediateDataChange(index, 'description', e.target.value)
                          }
                          placeholder="Введите описание"
                        />
                      </div>
                      <div className="form-group">
                        <label>Единица измерения</label>
                        <Input
                          value={field.unit || ''}
                          onChange={e =>
                            handleIntermediateDataChange(index, 'unit', e.target.value)
                          }
                          placeholder="Введите единицу измерения"
                        />
                      </div>
                      {!field.use_threshold_table && (
                        <div className="intermediate-rounding-section">
                          <div className="intermediate-rounding-title">
                            Округление промежуточного значения
                          </div>
                          <Radio.Group
                            className="intermediate-rounding-modes"
                            value={getIntermediateRoundingMode(field)}
                            onChange={e =>
                              applyIntermediateRoundingMode(
                                index,
                                e.target.value as 'result' | 'custom' | 'multiple'
                              )
                            }
                          >
                            <Radio value="result">Как у результата</Radio>
                            <Radio value="custom">Задать своё</Radio>
                            <Radio value="multiple">Округлять до ближайшего кратного</Radio>
                          </Radio.Group>
                          {getIntermediateRoundingMode(field) === 'custom' && (
                            <div className="intermediate-rounding-nested">
                              <div className="form-group">
                                <label>Тип округления</label>
                                <Select
                                  value={field.rounding_type ?? 'decimal'}
                                  onChange={value =>
                                    handleIntermediateDataChange(index, 'rounding_type', value)
                                  }
                                  placeholder="Выберите тип округления"
                                  listHeight={100}
                                >
                                  <Option value="decimal">До десятичного знака</Option>
                                  <Option value="significant">До значащей цифры</Option>
                                </Select>
                              </div>
                              <div className="form-group">
                                <label>Количество знаков округления</label>
                                <Input
                                  type="number"
                                  value={field.rounding_decimal ?? 0}
                                  onChange={e =>
                                    handleIntermediateDataChange(
                                      index,
                                      'rounding_decimal',
                                      parseInt(e.target.value, 10) || 0
                                    )
                                  }
                                  min={0}
                                  placeholder="Количество знаков"
                                />
                              </div>
                            </div>
                          )}
                          {getIntermediateRoundingMode(field) === 'multiple' && (
                            <div className="intermediate-rounding-nested">
                              <div className="form-group">
                                <label>Кратное значение</label>
                                <Input
                                  type="number"
                                  value={field.multiple_value || ''}
                                  onChange={e =>
                                    handleIntermediateDataChange(
                                      index,
                                      'multiple_value',
                                      e.target.value
                                    )
                                  }
                                  placeholder="Например: 10"
                                  min="0"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <div>
                        <Checkbox
                          checked={field.use_threshold_table || false}
                          onChange={e => {
                            handleIntermediateDataChange(
                              index,
                              'use_threshold_table',
                              e.target.checked
                            );
                            if (e.target.checked) {
                              handleIntermediateDataChange(index, 'formula', '');
                              handleIntermediateDataChange(index, 'range_calculation', null);
                              handleIntermediateDataChange(index, 'threshold_table_values', {
                                target_variable: '',
                                higher_variable: '',
                                lower_variable: '',
                              });
                            }
                          }}
                        >
                          Использовать метод ближайших табличных значений
                        </Checkbox>
                        {field.use_threshold_table && (
                          <div className="form-group-spacing">
                            <div className="form-group">
                              <label>Переменная для определения направления округления</label>
                              <div className="formula-input-container">
                                <Input
                                  value={field.threshold_table_values?.target_variable || ''}
                                  onChange={e =>
                                    handleIntermediateDataChange(index, 'threshold_table_values', {
                                      ...field.threshold_table_values,
                                      target_variable: e.target.value,
                                    })
                                  }
                                  onFocus={() => setActiveFormulaField(`threshold-target-${index}`)}
                                  onBlur={() => {
                                    setTimeout(() => {
                                      setActiveFormulaField(null);
                                    }, 200);
                                  }}
                                  onKeyDown={e => {
                                    if (
                                      e.key === 'Backspace' ||
                                      e.key === 'Delete' ||
                                      e.key === 'ArrowLeft' ||
                                      e.key === 'ArrowRight' ||
                                      ((e.ctrlKey || e.metaKey) &&
                                        ['c', 'v', 'a', 'x'].includes(e.key.toLowerCase()))
                                    ) {
                                      return;
                                    }
                                    e.preventDefault();
                                  }}
                                  ref={el => {
                                    if (!formulaRefs.threshold) formulaRefs.threshold = {};
                                    if (!formulaRefs.threshold[index])
                                      formulaRefs.threshold[index] = {};
                                    formulaRefs.threshold[index].target = el;
                                  }}
                                  placeholder="Введите название переменной (например: p)"
                                />
                                {activeFormulaField === `threshold-target-${index}` && (
                                  <div onMouseDown={e => e.preventDefault()}>
                                    <FormulaKeyboard
                                      onKeyPress={value => {
                                        const inputRef = formulaRefs.threshold[index]?.target;
                                        if (!inputRef?.input) return;
                                        const input = inputRef.input;

                                        const start = input.selectionStart || 0;
                                        const end = input.selectionEnd || 0;

                                        if (value === 'backspace') {
                                          if (start !== end) {
                                            const newValue =
                                              input.value.substring(0, start) +
                                              input.value.substring(end);
                                            handleIntermediateDataChange(
                                              index,
                                              'threshold_table_values',
                                              {
                                                ...field.threshold_table_values,
                                                target_variable: newValue,
                                              }
                                            );
                                            setTimeout(() => {
                                              input.selectionStart = input.selectionEnd = start;
                                              input.focus();
                                            }, 0);
                                          } else if (start > 0) {
                                            const newValue =
                                              input.value.substring(0, start - 1) +
                                              input.value.substring(end);
                                            handleIntermediateDataChange(
                                              index,
                                              'threshold_table_values',
                                              {
                                                ...field.threshold_table_values,
                                                target_variable: newValue,
                                              }
                                            );
                                            setTimeout(() => {
                                              input.selectionStart = input.selectionEnd = start - 1;
                                              input.focus();
                                            }, 0);
                                          }
                                        } else {
                                          const newValue =
                                            input.value.substring(0, start) +
                                            value +
                                            input.value.substring(end);
                                          handleIntermediateDataChange(
                                            index,
                                            'threshold_table_values',
                                            {
                                              ...field.threshold_table_values,
                                              target_variable: newValue,
                                            }
                                          );
                                          setTimeout(() => {
                                            input.selectionStart = input.selectionEnd =
                                              start + value.length;
                                            input.focus();
                                          }, 0);
                                        }
                                      }}
                                      variables={getAvailableVariables('intermediate', index)}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="form-group">
                              <label>Переменная для значения при округлении вверх</label>
                              <div className="formula-input-container">
                                <Input
                                  value={field.threshold_table_values?.higher_variable || ''}
                                  onChange={e =>
                                    handleIntermediateDataChange(index, 'threshold_table_values', {
                                      ...field.threshold_table_values,
                                      higher_variable: e.target.value,
                                    })
                                  }
                                  onFocus={() => setActiveFormulaField(`threshold-higher-${index}`)}
                                  onBlur={() => {
                                    setTimeout(() => {
                                      setActiveFormulaField(null);
                                    }, 200);
                                  }}
                                  onKeyDown={e => {
                                    if (
                                      e.key === 'Backspace' ||
                                      e.key === 'Delete' ||
                                      e.key === 'ArrowLeft' ||
                                      e.key === 'ArrowRight' ||
                                      ((e.ctrlKey || e.metaKey) &&
                                        ['c', 'v', 'a', 'x'].includes(e.key.toLowerCase()))
                                    ) {
                                      return;
                                    }
                                    e.preventDefault();
                                  }}
                                  ref={el => {
                                    if (!formulaRefs.threshold) formulaRefs.threshold = {};
                                    if (!formulaRefs.threshold[index])
                                      formulaRefs.threshold[index] = {};
                                    formulaRefs.threshold[index].higher = el;
                                  }}
                                  placeholder="Введите название переменной (например: pтабл_при_tнаиб)"
                                />
                                {activeFormulaField === `threshold-higher-${index}` && (
                                  <div onMouseDown={e => e.preventDefault()}>
                                    <FormulaKeyboard
                                      onKeyPress={value => {
                                        const inputRef = formulaRefs.threshold[index]?.higher;
                                        if (!inputRef?.input) return;
                                        const input = inputRef.input;

                                        const start = input.selectionStart || 0;
                                        const end = input.selectionEnd || 0;

                                        if (value === 'backspace') {
                                          if (start !== end) {
                                            const newValue =
                                              input.value.substring(0, start) +
                                              input.value.substring(end);
                                            handleIntermediateDataChange(
                                              index,
                                              'threshold_table_values',
                                              {
                                                ...field.threshold_table_values,
                                                higher_variable: newValue,
                                              }
                                            );
                                            setTimeout(() => {
                                              input.selectionStart = input.selectionEnd = start;
                                              input.focus();
                                            }, 0);
                                          } else if (start > 0) {
                                            const newValue =
                                              input.value.substring(0, start - 1) +
                                              input.value.substring(end);
                                            handleIntermediateDataChange(
                                              index,
                                              'threshold_table_values',
                                              {
                                                ...field.threshold_table_values,
                                                higher_variable: newValue,
                                              }
                                            );
                                            setTimeout(() => {
                                              input.selectionStart = input.selectionEnd = start - 1;
                                              input.focus();
                                            }, 0);
                                          }
                                        } else {
                                          const newValue =
                                            input.value.substring(0, start) +
                                            value +
                                            input.value.substring(end);
                                          handleIntermediateDataChange(
                                            index,
                                            'threshold_table_values',
                                            {
                                              ...field.threshold_table_values,
                                              higher_variable: newValue,
                                            }
                                          );
                                          setTimeout(() => {
                                            input.selectionStart = input.selectionEnd =
                                              start + value.length;
                                            input.focus();
                                          }, 0);
                                        }
                                      }}
                                      variables={getAvailableVariables('intermediate', index)}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="form-group">
                              <label>Переменная для значения при округлении вниз</label>
                              <div className="formula-input-container">
                                <Input
                                  value={field.threshold_table_values?.lower_variable || ''}
                                  onChange={e =>
                                    handleIntermediateDataChange(index, 'threshold_table_values', {
                                      ...field.threshold_table_values,
                                      lower_variable: e.target.value,
                                    })
                                  }
                                  onFocus={() => setActiveFormulaField(`threshold-lower-${index}`)}
                                  onBlur={() => {
                                    setTimeout(() => {
                                      setActiveFormulaField(null);
                                    }, 200);
                                  }}
                                  onKeyDown={e => {
                                    if (
                                      e.key === 'Backspace' ||
                                      e.key === 'Delete' ||
                                      e.key === 'ArrowLeft' ||
                                      e.key === 'ArrowRight' ||
                                      ((e.ctrlKey || e.metaKey) &&
                                        ['c', 'v', 'a', 'x'].includes(e.key.toLowerCase()))
                                    ) {
                                      return;
                                    }
                                    e.preventDefault();
                                  }}
                                  ref={el => {
                                    if (!formulaRefs.threshold) formulaRefs.threshold = {};
                                    if (!formulaRefs.threshold[index])
                                      formulaRefs.threshold[index] = {};
                                    formulaRefs.threshold[index].lower = el;
                                  }}
                                  placeholder="Введите название переменной (например: pтабл_при_tнаим)"
                                />
                                {activeFormulaField === `threshold-lower-${index}` && (
                                  <div onMouseDown={e => e.preventDefault()}>
                                    <FormulaKeyboard
                                      onKeyPress={value => {
                                        const inputRef = formulaRefs.threshold[index]?.lower;
                                        if (!inputRef?.input) return;
                                        const input = inputRef.input;

                                        const start = input.selectionStart || 0;
                                        const end = input.selectionEnd || 0;

                                        if (value === 'backspace') {
                                          if (start !== end) {
                                            const newValue =
                                              input.value.substring(0, start) +
                                              input.value.substring(end);
                                            handleIntermediateDataChange(
                                              index,
                                              'threshold_table_values',
                                              {
                                                ...field.threshold_table_values,
                                                lower_variable: newValue,
                                              }
                                            );
                                            setTimeout(() => {
                                              input.selectionStart = input.selectionEnd = start;
                                              input.focus();
                                            }, 0);
                                          } else if (start > 0) {
                                            const newValue =
                                              input.value.substring(0, start - 1) +
                                              input.value.substring(end);
                                            handleIntermediateDataChange(
                                              index,
                                              'threshold_table_values',
                                              {
                                                ...field.threshold_table_values,
                                                lower_variable: newValue,
                                              }
                                            );
                                            setTimeout(() => {
                                              input.selectionStart = input.selectionEnd = start - 1;
                                              input.focus();
                                            }, 0);
                                          }
                                        } else {
                                          const newValue =
                                            input.value.substring(0, start) +
                                            value +
                                            input.value.substring(end);
                                          handleIntermediateDataChange(
                                            index,
                                            'threshold_table_values',
                                            {
                                              ...field.threshold_table_values,
                                              lower_variable: newValue,
                                            }
                                          );
                                          setTimeout(() => {
                                            input.selectionStart = input.selectionEnd =
                                              start + value.length;
                                            input.focus();
                                          }, 0);
                                        }
                                      }}
                                      variables={getAvailableVariables('intermediate', index)}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <Checkbox
                        checked={field.show_calculation}
                        onChange={e =>
                          handleIntermediateDataChange(index, 'show_calculation', e.target.checked)
                        }
                      >
                        Показывать расчет
                      </Checkbox>
                    </div>
                  ))}
                  <button type="button" onClick={addIntermediateField} className="add-field-btn">
                    + Добавить промежуточную переменную
                  </button>
                </div>

                <div className="form-group">
                  <label>Формула</label>
                  {renderFormulaInput(
                    formData.formula,
                    e => handleInputChange(e),
                    'main',
                    null,
                    'Введите формулу расчета'
                  )}
                </div>

                <div className="form-group">
                  <label>Единица измерения</label>
                  <Input
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    placeholder="Введите единицу измерения"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Метод измерения</label>
                  <Input
                    name="measurement_method"
                    value={formData.measurement_method}
                    onChange={handleInputChange}
                    placeholder="Введите метод измерения"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Шифр НД</label>
                  <Input
                    name="nd_code"
                    value={formData.nd_code}
                    onChange={handleInputChange}
                    placeholder="Введите шифр НД"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Наименование НД</label>
                  <Input
                    name="nd_name"
                    value={formData.nd_name}
                    onChange={handleInputChange}
                    placeholder="Введите наименование НД"
                    required
                  />
                </div>

                <div className="form-section">
                  <h3>Условия повторяемости</h3>
                  {formData.convergence_conditions.formulas.map((condition, index) => (
                    <div key={index} className="field-group">
                      {formData.convergence_conditions.formulas.length > 1 && (
                        <button
                          type="button"
                          className="delete-field-btn"
                          onClick={() => deleteConvergenceCondition(index)}
                        >
                          ×
                        </button>
                      )}
                      <div className="form-group">
                        <label>Формула условия</label>
                        {renderFormulaInput(
                          condition.formula,
                          e => handleConvergenceChange(index, 'formula', e.target.value),
                          'convergence',
                          index,
                          'Например: (T₁-T₂) ≤ 2'
                        )}
                      </div>
                      <div className="form-group">
                        <label>Значение повторяемости</label>
                        <Select
                          value={condition.convergence_value}
                          onChange={value =>
                            handleConvergenceChange(index, 'convergence_value', value)
                          }
                          placeholder="Выберите значение повторяемости"
                          listHeight={100}
                        >
                          {CONVERGENCE_OPTIONS.map(option => (
                            <Option key={option.value} value={option.value}>
                              {option.label}
                            </Option>
                          ))}
                        </Select>
                      </div>
                      {condition.convergence_value === 'custom' && (
                        <div className="form-group">
                          <label>Текст результата при выполнении условия</label>
                          <Input
                            value={condition.custom_value || ''}
                            onChange={e =>
                              handleConvergenceChange(index, 'custom_value', e.target.value)
                            }
                            placeholder="Введите текст, который будет показан как результат"
                            required
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addConvergenceCondition} className="add-field-btn">
                    + Добавить условие повторяемости
                  </button>
                </div>

                <div className="form-group">
                  <label>Тип погрешности</label>
                  <Select
                    value={formData.measurement_error.type}
                    onChange={value => {
                      if (value === 'fixed' || value === 'formula' || value === 'range') {
                        handleMeasurementErrorTypeChange(value);
                      }
                    }}
                    placeholder="Выберите тип погрешности"
                    listHeight={100}
                  >
                    <Option value="fixed">Фиксированное значение</Option>
                    <Option value="formula">Формула</Option>
                  </Select>
                </div>

                {formData.measurement_error.type !== 'range' && (
                  <div className="form-group">
                    <label>
                      {formData.measurement_error.type === 'fixed'
                        ? 'Значение погрешности'
                        : 'Формула погрешности'}
                    </label>
                    {formData.measurement_error.type === 'formula' ? (
                      renderFormulaInput(
                        formData.measurement_error.value,
                        e => handleMeasurementErrorValueChange(e),
                        'error',
                        null,
                        'Введите формулу для расчета погрешности'
                      )
                    ) : (
                      <Input
                        value={formData.measurement_error.value}
                        onChange={e => handleMeasurementErrorValueChange(e.target.value)}
                        placeholder="Введите числовое значение"
                        required
                      />
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label>Тип округления</label>
                  <Select
                    value={formData.rounding_type}
                    onChange={value => {
                      const e = {
                        target: { name: 'rounding_type', value },
                      } as React.ChangeEvent<HTMLInputElement>;
                      handleInputChange(e);
                    }}
                    placeholder="Выберите тип округления"
                    listHeight={100}
                  >
                    <Option value="decimal">До десятичного знака</Option>
                    <Option value="significant">До значащей цифры</Option>
                  </Select>
                </div>

                <div className="form-group">
                  <label>Количество знаков округления</label>
                  <Input
                    type="number"
                    name="rounding_decimal"
                    value={formData.rounding_decimal}
                    onChange={handleInputChange}
                    required
                    min="0"
                    placeholder="Количество знаков"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CreateCalculationModal;
