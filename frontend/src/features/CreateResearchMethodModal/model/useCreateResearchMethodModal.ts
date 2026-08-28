import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useCreateResearchMethod,
  useCreateResearchMethodGroup,
  useReplaceResearchMethod,
  useResearchMethod,
  useResearchMethodsForGroupCreate,
} from '@/entities/ResearchMethod';
import { useTestObjectSampleTypeOptions } from '@/entities/TestObject';
import { notify } from '@/shared/lib/notify';
import { buildResearchMethodCreatePayload, methodToFormData } from '../lib';
import { createClientKey } from '../lib/createClientKey';
import { createEmptyResearchMethodFormData } from './initialFormData';
import { useFixturePrefill } from './useFixturePrefill';
import { useFormulaFieldEditor } from './useFormulaFieldEditor';
import type { IntermediateFieldForm, ResearchMethodFormData } from '../lib';
import type {
  ResearchMethod,
  ResearchMethodCreate,
  ResearchMethodGroup,
} from '@/entities/ResearchMethod';
import type { ChangeEvent } from 'react';

export type CreateResearchMethodModalParams = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (method: ResearchMethod | ResearchMethodGroup) => void;
  laboratoryId?: number;
  departmentId?: number;
  laboratoryName?: string;
  editMethodId?: number;
};

export const useCreateResearchMethodModal = ({
  open,
  onClose,
  onSuccess,
  laboratoryId,
  departmentId,
  laboratoryName,
  editMethodId,
}: CreateResearchMethodModalParams) => {
  const createResearchMethodMutation = useCreateResearchMethod();
  const createResearchMethodGroupMutation = useCreateResearchMethodGroup();
  const replaceResearchMethodMutation = useReplaceResearchMethod();

  const { options: catalogSampleTypeOptions, isLoading: isSampleTypeOptionsLoading } =
    useTestObjectSampleTypeOptions(laboratoryId, departmentId, open);

  const isEditMode = editMethodId != null;
  const [activeTab, setActiveTab] = useState<'single' | 'group'>('single');
  const [isAnimating, setIsAnimating] = useState(false);
  const hydratedEditMethodIdRef = useRef<number | null>(null);

  const {
    data: loadedMethod,
    isLoading: isLoadingMethod,
    error: editMethodError,
  } = useResearchMethod(editMethodId ?? null, open && isEditMode);

  const [formData, setFormData] = useState<ResearchMethodFormData>(
    createEmptyResearchMethodFormData
  );

  const sampleTypeOptions = catalogSampleTypeOptions;

  const catalogTagSet = useMemo(
    () => new Set(catalogSampleTypeOptions.map(option => option.value)),
    [catalogSampleTypeOptions]
  );

  useEffect(() => {
    if (!open || isSampleTypeOptionsLoading) {
      return;
    }

    setFormData(prev => {
      const filteredSampleTypes = prev.sample_type.filter(tag => catalogTagSet.has(tag));
      if (filteredSampleTypes.length === prev.sample_type.length) {
        return prev;
      }
      return { ...prev, sample_type: filteredSampleTypes };
    });
  }, [open, isSampleTypeOptionsLoading, catalogTagSet]);

  const [groupData, setGroupData] = useState<{
    name: string;
    selectedMethods: number[];
  }>({
    name: '',
    selectedMethods: [],
  });

  const availableMethodsQuery = useResearchMethodsForGroupCreate(
    laboratoryId,
    departmentId,
    open && !isEditMode && activeTab === 'group' && laboratoryId != null
  );

  const availableMethods = useMemo(() => {
    const items = availableMethodsQuery.data?.items ?? [];
    const individual_methods = items.filter(method => {
      const hasActiveGroup = method.groups?.some(group => group.deleted_at == null);
      return !hasActiveGroup;
    });
    return { individual_methods, groups: [] as { id: number; name: string }[] };
  }, [availableMethodsQuery.data]);

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

  const formulaEditor = useFormulaFieldEditor({
    formData,
    setFormData,
    onMeasurementErrorRangeFormulaChange: (index, formula) => {
      handleMeasurementErrorRangeChange(index, 'formula', formula);
    },
  });

  const {
    fixtureTreeData,
    selectedFixture,
    isLoadingFixtures,
    applyTemplateSelection,
    loadFixtureFilesForDirectory,
  } = useFixturePrefill({
    open,
    enabled: open && !isEditMode && activeTab === 'single',
    laboratoryName,
    setFormData,
  });

  useEffect(() => {
    if (!open) {
      hydratedEditMethodIdRef.current = null;
      setFormData(createEmptyResearchMethodFormData());
      setGroupData({ name: '', selectedMethods: [] });
      setActiveTab('single');
      return;
    }
    if (!isEditMode || loadedMethod == null || editMethodId == null) {
      return;
    }
    if (hydratedEditMethodIdRef.current === editMethodId) {
      return;
    }
    hydratedEditMethodIdRef.current = editMethodId;
    setFormData(methodToFormData(loadedMethod));
  }, [open, isEditMode, editMethodId, loadedMethod]);

  useEffect(() => {
    if (open && isEditMode && editMethodError) {
      notify.error('Не удалось загрузить метод исследования');
    }
  }, [open, isEditMode, editMethodError]);

  useEffect(() => {
    if (open && !isEditMode && activeTab === 'group' && availableMethodsQuery.isError) {
      notify.error('Не удалось загрузить список доступных методов');
    }
  }, [open, isEditMode, activeTab, availableMethodsQuery.isError]);

  const handleGroupDataChange = (field: string, value: unknown) => {
    setGroupData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
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
      const existing = newInputData[index];
      if (!existing) {
        return prevData;
      }
      newInputData[index] = {
        ...existing,
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
      const existing = fields[index];
      if (!existing) {
        return prev;
      }
      const field = { ...existing };

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
    const existing = updatedData.convergence_conditions.formulas[index] ?? {
      clientKey: createClientKey(),
      formula: '',
      convergence_value: 'satisfactory',
    };
    updatedData.convergence_conditions.formulas[index] = {
      ...existing,
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
            clientKey: createClientKey(),
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
            clientKey: createClientKey(),
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
      const existingField = fields[fieldIndex];
      if (!existingField) {
        return prev;
      }
      const field = { ...existingField };

      if (!field.range_calculation) {
        field.range_calculation = { ranges: [] };
      }

      const ranges = [...field.range_calculation.ranges];
      const existingRange = ranges[rangeIndex];
      ranges[rangeIndex] = {
        clientKey: existingRange?.clientKey ?? createClientKey(),
        condition: existingRange?.condition ?? '',
        formula: existingRange?.formula ?? '',
        [key]: value,
      };

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
      const existingField = fields[fieldIndex];
      if (!existingField) {
        return prev;
      }
      const field = { ...existingField };

      if (!field.range_calculation) {
        field.range_calculation = { ranges: [] };
      }

      field.range_calculation.ranges = [
        ...(field.range_calculation.ranges || []),
        { clientKey: createClientKey(), condition: '', formula: '' },
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
      const existingField = fields[fieldIndex];
      if (!existingField) {
        return prev;
      }
      const field = { ...existingField };

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
            clientKey: createClientKey(),
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

  const handleMeasurementErrorTypeChange = (type: 'fixed' | 'formula' | 'range' | 'none') => {
    setFormData(prev => ({
      ...prev,
      measurement_error: {
        type,
        value: '',
        ranges: [],
      },
    }));
  };

  const handleMeasurementErrorValueChange = (value: string | ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      measurement_error: {
        ...prev.measurement_error,
        value: typeof value === 'object' ? value.target.value : value,
      },
    }));
  };

  const buildCreatePayload = (): ResearchMethodCreate =>
    buildResearchMethodCreatePayload(formData, catalogTagSet, laboratoryId, departmentId);

  const handleSubmit = async () => {
    try {
      if (isEditMode && loadedMethod && editMethodId != null) {
        if (!formData.name.trim()) {
          notify.error('Введите название формулы');
          return;
        }
        if (formData.sample_type.length === 0) {
          notify.error('Выберите хотя бы один тип пробы');
          return;
        }
        const groupId = loadedMethod.groups?.[0]?.id;
        const dataToSend: ResearchMethodCreate = {
          ...buildCreatePayload(),
          sort_order: loadedMethod.sort_order ?? undefined,
          equipment_data_default: loadedMethod.equipment_data_default ?? undefined,
          laboratory_id: loadedMethod.laboratory_id ?? laboratoryId,
          department_id: loadedMethod.department_id ?? departmentId,
          is_group_member: false,
        };
        const response = await replaceResearchMethodMutation.mutateAsync({
          editMethodId,
          data: dataToSend,
          groupId,
        });
        onSuccess?.(response);
        onClose();
        return;
      }

      if (activeTab === 'group') {
        if (!groupData.name.trim()) {
          notify.error('Введите название группы');
          return;
        }
        if (groupData.selectedMethods.length === 0) {
          notify.error('Выберите хотя бы один метод для группы');
          return;
        }

        const groupResponse = await createResearchMethodGroupMutation.mutateAsync({
          name: groupData.name,
          method_ids: groupData.selectedMethods,
        });

        if (groupResponse) {
          onSuccess?.(groupResponse);
          onClose();
        }
      } else {
        if (!formData.name.trim()) {
          notify.error('Введите название формулы');
          return;
        }

        if (formData.sample_type.length === 0) {
          notify.error('Выберите хотя бы один тип пробы');
          return;
        }

        const dataToSend = buildCreatePayload();
        const response = await createResearchMethodMutation.mutateAsync(dataToSend);

        if (response) {
          onSuccess?.(response);
          onClose();
        }
      }
    } catch {
      notify.error('Не удалось сохранить метод исследования');
    }
  };

  const handleTabChange = (tab: 'single' | 'group') => {
    if (tab !== activeTab) {
      setIsAnimating(true);
      if (tab === 'group') {
        setFormData(createEmptyResearchMethodFormData());
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

  const showSingleForm = isEditMode || activeTab === 'single';

  return {
    activeTab,
    isAnimating,
    isEditMode,
    isLoadingMethod,
    isLoadingMethods: availableMethodsQuery.isLoading,
    isLoadingFixtures,
    isSampleTypeOptionsLoading,
    formData,
    setFormData,
    groupData,
    setGroupData,
    availableMethods,
    sampleTypeOptions,
    fixtureTreeData,
    selectedFixture,
    showSingleForm,
    formulaEditor,
    handleSubmit,
    handleTabChange,
    handleGroupDataChange,
    handleInputChange,
    handleSampleTypeChange,
    handleInputDataChange,
    handleIntermediateDataChange,
    getIntermediateRoundingMode,
    applyIntermediateRoundingMode,
    handleConvergenceChange,
    deleteInputField,
    deleteIntermediateField,
    addInputField,
    addIntermediateField,
    handleIntermediateRangeChange,
    addIntermediateRange,
    deleteIntermediateRange,
    addConvergenceCondition,
    deleteConvergenceCondition,
    handleMeasurementErrorTypeChange,
    handleMeasurementErrorValueChange,
    applyTemplateSelection,
    loadFixtureFilesForDirectory,
  };
};
