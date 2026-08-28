import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { formatBranchDisplay, useBranches } from '@/entities/Branch';
import { type Employee } from '@/entities/Employee';
import { useLaboratory } from '@/entities/Laboratory';
import {
  resolvePermissionsForScope,
  SAMPLING_TERMINOLOGY_LABELS,
  usePermissionsContext,
} from '@/entities/Role';
import {
  useCreateSample,
  useSampleTypes,
  type SampleCreate,
  type SampleFormValues,
} from '@/entities/Sample';
import { useSamplingLocationsByBranch } from '@/entities/SamplingLocation';
import { useSelectionConditionsFields } from '@/entities/SelectionCondition';
import { useTestObjectNames } from '@/entities/TestObject';
import { useWellModesByBranch } from '@/entities/WellMode';
import { extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';

dayjs.locale('ru');

const EMPTY_FORM: SampleFormValues = {
  registration_number: '',
  sample_type: undefined,
  test_object: undefined,
  sampling_date: null,
  receiving_date: null,
  branch_id: undefined,
  sampling_location_id: undefined,
  well: '',
  mode: undefined,
  indicators_count: undefined,
};

const REQUIRED_FIELDS_MESSAGE = 'Пожалуйста, заполните все обязательные поля';

export type UseCreateSampleModalParams = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  laboratoryId?: number;
  departmentId?: number;
};

/** Оркестрация модалки создания пробы. */
export const useCreateSampleModal = ({
  open,
  onClose,
  onSuccess,
  laboratoryId,
  departmentId,
}: UseCreateSampleModalParams) => {
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

  const createSampleMutation = useCreateSample();
  const [formData, setFormData] = useState<SampleFormValues>(EMPTY_FORM);
  const [addedBy, setAddedBy] = useState<Employee | null>(null);
  const [errors, setErrors] = useState<
    Partial<Record<keyof SampleFormValues | 'added_by', boolean>>
  >({});
  const [selectionConditions, setSelectionConditions] = useState<Record<string, string>>({});

  const { data: sampleTypes = [] } = useSampleTypes();
  const { data: testObjectOptions = [] } = useTestObjectNames(
    laboratoryId,
    departmentId,
    open,
    'select'
  );
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
  const { data: laboratory } = useLaboratory(laboratoryId, !!laboratoryId);
  const laboratoryName = laboratory?.full_name || '';

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
    const newErrors: Partial<Record<keyof SampleFormValues | 'added_by', boolean>> = {};
    if (!formData.registration_number) {
      newErrors.registration_number = true;
    }
    if (!formData.test_object) {
      newErrors.test_object = true;
    }
    if (formData.indicators_count === undefined || formData.indicators_count === null) {
      newErrors.indicators_count = true;
    }
    if (!addedBy) {
      newErrors.added_by = true;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      notify.error(REQUIRED_FIELDS_MESSAGE);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    const testObject = formData.test_object;
    const indicatorsCount = formData.indicators_count;
    if (testObject == null || indicatorsCount == null || laboratoryId == null) {
      return;
    }

    const processedSelectionConditions: Record<string, string> = {};
    Object.keys(selectionConditions).forEach(key => {
      const value = selectionConditions[key];
      if (value && value.trim() !== '') {
        processedSelectionConditions[key] = value.replace(',', '.');
      }
    });

    const sampleData: SampleCreate = {
      registration_number: formData.registration_number,
      sample_type: formData.sample_type || undefined,
      test_object: testObject,
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
      added_by: addedBy?.hsnils || undefined,
      laboratory_id: laboratoryId,
      department_id: departmentId,
    };

    try {
      await createSampleMutation.mutateAsync(sampleData);
      setFormData(EMPTY_FORM);
      setAddedBy(null);
      setSelectionConditions({});
      setErrors({});
      onSuccess();
    } catch (error: unknown) {
      notify.error(extractErrorMessage(error, 'Не удалось добавить пробу'));
    }
  };

  const handleSelectionConditionChange = (field: string, value: string) => {
    setSelectionConditions(prev => ({
      ...prev,
      [field]: value === '' ? '' : value,
    }));
  };

  const handleAddedByChange = (employee: Employee | null) => {
    setAddedBy(employee);
    if (errors.added_by) {
      setErrors(prev => ({ ...prev, added_by: false }));
    }
  };

  const handleCancel = () => {
    setFormData(EMPTY_FORM);
    setAddedBy(null);
    setSelectionConditions({});
    setErrors({});
    onClose();
  };

  return {
    formData,
    errors,
    canShow,
    terminologyLabel,
    sampleTypes,
    testObjectOptions,
    branchOptions,
    branchesLoading,
    samplingLocationOptions,
    locationsLoading,
    wellModeOptions,
    wellModesLoading,
    addedBy,
    handleAddedByChange,
    laboratoryName,
    selectionConditionsFields,
    selectionConditions,
    handleSelectionConditionChange,
    handleFieldChange,
    handleSave,
    handleCancel,
  };
};
