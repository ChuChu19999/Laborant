import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { formatBranchDisplay, useBranches } from '@/entities/Branch';
import { useEmployeeByHsnils } from '@/entities/Employee';
import {
  resolvePermissionsForScope,
  SAMPLING_TERMINOLOGY_LABELS,
  usePermissionsContext,
} from '@/entities/Role';
import {
  useSampleTypes,
  useUpdateSample,
  type Sample,
  type SampleFormValues,
  type SampleUpdate,
} from '@/entities/Sample';
import { useSamplingLocationsByBranch } from '@/entities/SamplingLocation';
import { useSelectionConditionsFields } from '@/entities/SelectionCondition';
import { useTestObjectNames } from '@/entities/TestObject';
import { useWellModesByBranch } from '@/entities/WellMode';
import { extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';

dayjs.locale('ru');

const REQUIRED_FIELDS_MESSAGE = 'Пожалуйста, заполните все обязательные поля';

const toFormValues = (sample: Sample): SampleFormValues => ({
  registration_number: sample.registration_number,
  sample_type: sample.sample_type as string | undefined,
  test_object: sample.test_object,
  sampling_date: sample.sampling_date ? dayjs(sample.sampling_date) : null,
  receiving_date: sample.receiving_date ? dayjs(sample.receiving_date) : null,
  branch_id: sample.branch_id,
  sampling_location_id: sample.sampling_location_id,
  well: sample.well || '',
  mode: sample.mode || undefined,
  indicators_count: sample.indicators_count,
});

export type UseEditSampleModalParams = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sample: Sample;
  laboratoryId?: number;
  departmentId?: number;
};

/** Оркестрация модалки редактирования пробы. */
export const useEditSampleModal = ({
  open,
  onClose,
  onSuccess,
  sample,
  laboratoryId,
  departmentId,
}: UseEditSampleModalParams) => {
  const { isAdmin, permissionsData } = usePermissionsContext();
  const scopedPermissions = useMemo(() => {
    if (isAdmin || permissionsData.is_admin) {
      return null;
    }
    return (
      resolvePermissionsForScope(permissionsData.scopes, laboratoryId, departmentId) ||
      permissionsData.permissions
    );
  }, [isAdmin, permissionsData, laboratoryId, departmentId]);

  const visibleFields = useMemo(() => {
    if (isAdmin || permissionsData.is_admin) {
      return new Set([
        'sample_type',
        'branch',
        'sampling_location',
        'well',
        'well_mode',
        'sampling_date',
        'receipt_date',
      ]);
    }
    return new Set(scopedPermissions?.samples.visible_fields || []);
  }, [isAdmin, permissionsData, scopedPermissions]);

  const terminologyLabel =
    SAMPLING_TERMINOLOGY_LABELS[
      scopedPermissions?.sampling_terminology ||
        permissionsData.permissions.sampling_terminology ||
        'well_mode'
    ];
  const canShow = (field: string) => visibleFields.has(field);

  const updateSampleMutation = useUpdateSample();
  const [formData, setFormData] = useState<SampleFormValues>(() => toFormValues(sample));
  const [errors, setErrors] = useState<Partial<Record<keyof SampleFormValues, boolean>>>({});
  const [selectionConditions, setSelectionConditions] = useState<Record<string, string>>({});

  const { data: sampleTypes = [] } = useSampleTypes();
  const { data: testObjectOptions = [] } = useTestObjectNames(
    laboratoryId,
    departmentId,
    open,
    'select'
  );
  const testObjectSelectOptions = useMemo(() => {
    const names = new Set(testObjectOptions);
    if (formData.test_object) {
      names.add(formData.test_object);
    }
    return Array.from(names);
  }, [testObjectOptions, formData.test_object]);

  const { data: branchesData, isLoading: branchesLoading } = useBranches(
    laboratoryId,
    departmentId,
    !!laboratoryId
  );
  const { data: samplingLocationsData, isLoading: locationsLoading } = useSamplingLocationsByBranch(
    formData.branch_id,
    !!formData.branch_id
  );
  const { data: wellModesData, isLoading: wellModesLoading } = useWellModesByBranch(
    formData.branch_id,
    !!formData.branch_id
  );
  const { data: selectionConditionsFields = [] } = useSelectionConditionsFields(
    laboratoryId,
    departmentId,
    !!laboratoryId
  );

  const { data: addedByEmployeeData } = useEmployeeByHsnils(
    sample.added_by,
    false,
    open && !!sample.added_by
  );
  const addedByEmployee = sample.added_by && addedByEmployeeData ? addedByEmployeeData : null;

  const branchOptions = useMemo(
    () =>
      (branchesData?.items || []).map(branch => ({
        value: branch.id,
        label: formatBranchDisplay(branch),
      })),
    [branchesData?.items]
  );
  const samplingLocationOptions = useMemo(
    () =>
      (samplingLocationsData?.items || []).map(location => ({
        value: location.id,
        label: location.name,
      })),
    [samplingLocationsData?.items]
  );
  const wellModeOptions = useMemo(
    () =>
      (wellModesData?.items || []).map(mode => ({
        value: mode.id,
        label: mode.name,
      })),
    [wellModesData?.items]
  );

  useEffect(() => {
    if (open && sample) {
      setFormData(toFormValues(sample));
      setErrors({});
      if (sample.selection_conditions && typeof sample.selection_conditions === 'object') {
        setSelectionConditions(sample.selection_conditions as Record<string, string>);
      } else {
        setSelectionConditions({});
      }
    }
  }, [open, sample]);

  const handleFieldChange = (patch: Partial<SampleFormValues>) => {
    setFormData(prev => ({ ...prev, ...patch }));
    const cleared = Object.keys(patch).filter(key => errors[key as keyof SampleFormValues]);
    if (cleared.length > 0) {
      setErrors(prev => {
        const next = { ...prev };
        cleared.forEach(key => {
          next[key as keyof SampleFormValues] = false;
        });
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof SampleFormValues, boolean>> = {};
    if (!formData.registration_number) {
      newErrors.registration_number = true;
    }
    if (!formData.test_object) {
      newErrors.test_object = true;
    }
    if (formData.indicators_count === undefined || formData.indicators_count === null) {
      newErrors.indicators_count = true;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      notify.error(REQUIRED_FIELDS_MESSAGE);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    const processedSelectionConditions: Record<string, string> = {};
    Object.keys(selectionConditions).forEach(key => {
      const value = selectionConditions[key];
      if (value && value.trim() !== '') {
        processedSelectionConditions[key] = value.replace(',', '.');
      }
    });

    const indicatorsCount = formData.indicators_count;
    if (indicatorsCount == null) {
      return;
    }

    const sampleData: SampleUpdate = {
      registration_number: formData.registration_number,
      sample_type: formData.sample_type ?? null,
      test_object: formData.test_object,
      sampling_date: formData.sampling_date
        ? dayjs(formData.sampling_date).format('YYYY-MM-DD')
        : undefined,
      receiving_date: formData.receiving_date
        ? dayjs(formData.receiving_date).format('YYYY-MM-DD')
        : undefined,
      branch_id: formData.branch_id || undefined,
      sampling_location_id: formData.sampling_location_id || undefined,
      well: formData.well || undefined,
      mode: formData.mode || undefined,
      indicators_count: indicatorsCount,
      selection_conditions:
        Object.keys(processedSelectionConditions).length > 0
          ? processedSelectionConditions
          : undefined,
    };

    try {
      await updateSampleMutation.mutateAsync({ id: sample.id, data: sampleData });
      onSuccess();
    } catch (error: unknown) {
      notify.error(extractErrorMessage(error, 'Не удалось обновить пробу'));
    }
  };

  const handleCancel = () => {
    setFormData(toFormValues(sample));
    setSelectionConditions({});
    setErrors({});
    onClose();
  };

  const handleSelectionConditionChange = (field: string, value: string) => {
    setSelectionConditions(prev => ({
      ...prev,
      [field]: value === '' ? '' : value,
    }));
  };

  return {
    formData,
    errors,
    canShow,
    terminologyLabel,
    sampleTypes,
    testObjectSelectOptions,
    branchOptions,
    branchesLoading,
    samplingLocationOptions,
    locationsLoading,
    wellModeOptions,
    wellModesLoading,
    addedByEmployee,
    selectionConditionsFields,
    selectionConditions,
    handleSelectionConditionChange,
    handleFieldChange,
    handleSubmit,
    handleCancel,
  };
};
