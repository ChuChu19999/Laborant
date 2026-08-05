import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { message } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { SelectionConditionsForm } from '../../../../entities/SelectionConditionsForm';
import { UserPicker, type Employee } from '../../../../entities/UserPicker';
import { employeesApi } from '../../../../shared/api/employees';
import { samplesApi } from '../../../../shared/api/samples';
import {
  samplingLocationsApi,
  type Branch,
  type SamplingLocation,
} from '../../../../shared/api/samplingLocations';
import { SAMPLING_TERMINOLOGY_LABELS } from '../../../../shared/config/permissions';
import { usePermissionsContext } from '../../../../shared/lib/permissions';
import { useUpdateSample } from '../../../../shared/model/hooks';
import { useAutoRefetchQuery } from '../../../../shared/model/lib/useQuery';
import { Input, Select, DatePicker } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import { formatBranchDisplay } from '../../../../shared/utils/branchFormatting';
import type {
  Sample,
  SampleUpdate,
  SelectionConditionsField,
} from '../../../../shared/api/samples';
import './EditSampleModal.css';

dayjs.locale('ru');

const { Option } = Select;

type EditSampleFormData = {
  registration_number: string;
  sample_type: string | undefined;
  test_object: string | undefined;
  sampling_date: dayjs.Dayjs | null;
  receiving_date: dayjs.Dayjs | null;
  branch_id: number | undefined;
  sampling_location_id: number | undefined;
  well: string;
  mode: string | undefined;
  indicators_count: number | undefined;
};

interface EditSampleModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sample: Sample;
  laboratoryId?: number;
  departmentId?: number;
}

const EditSampleModal: React.FC<EditSampleModalProps> = ({
  open,
  onClose,
  onSuccess,
  sample,
  laboratoryId,
  departmentId,
}) => {
  const { isAdmin, permissionsData } = usePermissionsContext();
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
    return new Set(permissionsData.permissions.samples.visible_fields);
  }, [isAdmin, permissionsData]);
  const terminologyLabel =
    SAMPLING_TERMINOLOGY_LABELS[permissionsData.permissions.sampling_terminology || 'well_mode'];
  const canShow = (field: string) => visibleFields.has(field);

  const updateSampleMutation = useUpdateSample();
  const [formData, setFormData] = useState<EditSampleFormData>({
    registration_number: sample.registration_number,
    sample_type: sample.sample_type as string | undefined,
    test_object: sample.test_object as string | undefined,
    sampling_date: sample.sampling_date ? dayjs(sample.sampling_date) : null,
    receiving_date: sample.receiving_date ? dayjs(sample.receiving_date) : null,
    branch_id: sample.branch_id as number | undefined,
    sampling_location_id: sample.sampling_location_id as number | undefined,
    well: sample.well || '',
    mode: sample.mode || undefined,
    indicators_count: sample.indicators_count,
  });
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const { data: sampleTypes = [] } = useAutoRefetchQuery<string[]>(['sample-types'], () =>
    samplesApi.getSampleTypes()
  );

  const { data: testObjectOptions = [] } = useAutoRefetchQuery(
    ['test-objects', 'select', laboratoryId, departmentId],
    () => samplesApi.getTestObjects(laboratoryId, departmentId),
    {
      enabled: open,
    }
  );

  const testObjectSelectOptions = React.useMemo(() => {
    const names = new Set(testObjectOptions);
    if (formData.test_object) {
      names.add(formData.test_object);
    }
    return Array.from(names);
  }, [testObjectOptions, formData.test_object]);

  const { data: branchesData, isLoading: branchesLoading } = useAutoRefetchQuery<{
    items: Branch[];
  }>(
    ['branches', laboratoryId, departmentId],
    () => samplingLocationsApi.getBranches(laboratoryId, departmentId),
    {
      enabled: !!laboratoryId,
    }
  );

  const branches = branchesData?.items || [];

  const { data: samplingLocationsData, isLoading: locationsLoading } = useAutoRefetchQuery<{
    items: SamplingLocation[];
  }>(
    ['sampling-locations', formData.branch_id],
    () => samplingLocationsApi.getSamplingLocations(formData.branch_id),
    {
      enabled: !!formData.branch_id,
    }
  );

  const samplingLocations = samplingLocationsData?.items || [];

  // Запрос на получение режимов скважин
  const { data: wellModesData, isLoading: wellModesLoading } = useAutoRefetchQuery<{
    items: import('../../../../shared/api/samplingLocations').WellMode[];
  }>(
    ['sampling-locations', 'well-modes', formData.branch_id],
    () => samplingLocationsApi.getWellModes(formData.branch_id),
    {
      enabled: !!formData.branch_id,
    }
  );

  const wellModes = wellModesData?.items || [];

  const { data: selectionConditionsFields = [] } = useAutoRefetchQuery<SelectionConditionsField[]>(
    ['selection-conditions-fields', laboratoryId, departmentId],
    () => samplesApi.getSelectionConditionsFields(laboratoryId!, departmentId),
    {
      enabled: !!laboratoryId,
    }
  );

  const [selectionConditions, setSelectionConditions] = useState<Record<string, string>>({});
  const [addedByEmployee, setAddedByEmployee] = useState<Employee | null>(null);

  // Загрузка информации о сотруднике, добавившем пробу
  useEffect(() => {
    const loadAddedByEmployee = async () => {
      if (sample.added_by) {
        try {
          const employee = await employeesApi.getByHsnils(sample.added_by, false);
          if (employee) {
            setAddedByEmployee(employee);
          }
        } catch (error) {
          console.error('Ошибка при загрузке информации о сотруднике:', error);
          setAddedByEmployee(null);
        }
      } else {
        setAddedByEmployee(null);
      }
    };

    if (open && sample) {
      loadAddedByEmployee();
    }
  }, [open, sample]);

  useEffect(() => {
    if (open && sample) {
      setFormData({
        registration_number: sample.registration_number,
        sample_type: sample.sample_type as string | undefined,
        test_object: sample.test_object as string | undefined,
        sampling_date: sample.sampling_date ? dayjs(sample.sampling_date) : null,
        receiving_date: sample.receiving_date ? dayjs(sample.receiving_date) : null,
        branch_id: sample.branch_id as number | undefined,
        sampling_location_id: sample.sampling_location_id as number | undefined,
        well: sample.well || '',
        mode: sample.mode || undefined,
        indicators_count: sample.indicators_count,
      });
      setErrors({});

      if (sample.selection_conditions && typeof sample.selection_conditions === 'object') {
        setSelectionConditions(sample.selection_conditions as Record<string, string>);
      } else {
        setSelectionConditions({});
      }
    }
  }, [open, sample]);

  const handleInputChange = useCallback(
    (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData(prev => ({
        ...prev,
        [field]: e.target.value,
      }));
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: false }));
      }
    },
    [errors]
  );

  const handleSelectChange = useCallback(
    (field: 'sample_type' | 'test_object' | 'branch_id' | 'sampling_location_id' | 'mode') =>
      (value: unknown) => {
        setFormData(prev => {
          const newData = {
            ...prev,
            [field]: value as (typeof formData)[typeof field],
          };

          // Сбрасываем место отбора и режим при изменении филиала
          if (field === 'branch_id') {
            newData.sampling_location_id = undefined;
            newData.mode = undefined;
          }

          return newData;
        });
        if (errors[field]) {
          setErrors(prev => ({ ...prev, [field]: false }));
        }
      },
    [errors]
  );

  const handleDateChange = useCallback(
    (field: 'sampling_date' | 'receiving_date') => (date: unknown) => {
      setFormData(prev => ({
        ...prev,
        [field]: (date as dayjs.Dayjs | null) || null,
      }));
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: false }));
      }
    },
    [errors]
  );

  const handleIndicatorsCountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === '') {
        setFormData(prev => ({ ...prev, indicators_count: undefined }));
      } else {
        const parsed = Number(raw);
        if (Number.isInteger(parsed) && parsed >= 0) {
          setFormData(prev => ({ ...prev, indicators_count: parsed }));
        }
      }
      if (errors.indicators_count) {
        setErrors(prev => ({ ...prev, indicators_count: false }));
      }
    },
    [errors.indicators_count]
  );

  const validateForm = useCallback((): boolean => {
    const requiredFields = ['registration_number', 'test_object', 'indicators_count'];
    const newErrors: Record<string, boolean> = {};

    requiredFields.forEach(field => {
      const value = formData[field as keyof typeof formData];
      if (value === undefined || value === null || value === '') {
        newErrors[field] = true;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      message.error('Пожалуйста, заполните все обязательные поля');
      return false;
    }

    setErrors({});
    return true;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
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
      indicators_count: formData.indicators_count!,
      selection_conditions:
        Object.keys(processedSelectionConditions).length > 0
          ? processedSelectionConditions
          : undefined,
    };

    try {
      await updateSampleMutation.mutateAsync({ id: sample.id, data: sampleData });
      onSuccess();
    } catch (error) {
      console.error('Ошибка при обновлении пробы:', error);
    }
  }, [formData, selectionConditions, sample.id, updateSampleMutation, onSuccess, validateForm]);

  const handleCancel = useCallback(() => {
    setFormData({
      registration_number: sample.registration_number,
      sample_type: sample.sample_type as string | undefined,
      test_object: sample.test_object as string | undefined,
      sampling_date: sample.sampling_date ? dayjs(sample.sampling_date) : null,
      receiving_date: sample.receiving_date ? dayjs(sample.receiving_date) : null,
      branch_id: sample.branch_id as number | undefined,
      sampling_location_id: sample.sampling_location_id as number | undefined,
      well: sample.well || '',
      mode: sample.mode || undefined,
      indicators_count: sample.indicators_count,
    });
    setSelectionConditions({});
    setErrors({});
    onClose();
  }, [onClose, sample]);

  const handleSelectionConditionChange = useCallback((field: string, value: string) => {
    setSelectionConditions(prev => ({
      ...prev,
      [field]: value === '' ? '' : value,
    }));
  }, []);

  if (!open) return null;

  return (
    <Modal
      header="Редактирование пробы"
      onClose={handleCancel}
      onCancel={handleCancel}
      onSave={handleSubmit}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="550"
    >
      <div className="create-sample-form">
        <div className="form-group">
          <label>
            Регистрационный номер <span className="required">*</span>
          </label>
          <Input
            value={formData.registration_number}
            onChange={handleInputChange('registration_number')}
            placeholder="Введите регистрационный номер"
            status={errors.registration_number ? 'error' : ''}
          />
        </div>

        {canShow('sample_type') && (
          <div className="form-group">
            <label>Тип пробы</label>
            <Select
              value={formData.sample_type}
              onChange={handleSelectChange('sample_type')}
              placeholder="Выберите тип пробы"
              status={errors.sample_type ? 'error' : ''}
              listHeight={100}
              allowClear
            >
              {sampleTypes.map(type => (
                <Option key={type} value={type}>
                  {type}
                </Option>
              ))}
            </Select>
          </div>
        )}

        <div className="form-group">
          <label>
            Объект испытаний <span className="required">*</span>
          </label>
          <Select
            value={formData.test_object}
            onChange={handleSelectChange('test_object')}
            placeholder="Выберите объект испытаний"
            status={errors.test_object ? 'error' : ''}
            listHeight={100}
            allowClear
          >
            {testObjectSelectOptions.map(name => (
              <Option key={name} value={name}>
                {name}
              </Option>
            ))}
          </Select>
        </div>

        <div className="form-group">
          <label>
            Количество показателей <span className="required">*</span>
          </label>
          <Input
            type="number"
            min={0}
            step={1}
            value={formData.indicators_count ?? ''}
            onChange={handleIndicatorsCountChange}
            placeholder="Введите количество показателей"
            status={errors.indicators_count ? 'error' : ''}
          />
        </div>

        {canShow('branch') && (
          <div className="form-group">
            <label>Филиал</label>
            <Select
              value={formData.branch_id}
              onChange={handleSelectChange('branch_id')}
              placeholder="Выберите филиал"
              loading={branchesLoading}
              listHeight={100}
              allowClear
            >
              {branches.map(branch => (
                <Option key={branch.id} value={branch.id}>
                  {formatBranchDisplay(branch)}
                </Option>
              ))}
            </Select>
          </div>
        )}

        {canShow('sampling_location') && (
          <div className="form-group">
            <label>Место отбора пробы</label>
            <Select
              value={formData.sampling_location_id}
              onChange={handleSelectChange('sampling_location_id')}
              placeholder="Выберите место отбора пробы"
              loading={locationsLoading}
              disabled={!formData.branch_id}
              listHeight={100}
              allowClear
            >
              {samplingLocations.map(location => (
                <Option key={location.id} value={location.id}>
                  {location.name}
                </Option>
              ))}
            </Select>
          </div>
        )}

        {canShow('well') && (
          <div className="form-group">
            <label>Скважина</label>
            <Input
              value={formData.well}
              onChange={handleInputChange('well')}
              placeholder="Введите скважину"
            />
          </div>
        )}

        {canShow('well_mode') && (
          <div className="form-group">
            <label>{terminologyLabel}</label>
            <Select
              value={formData.mode}
              onChange={handleSelectChange('mode')}
              placeholder={`Выберите: ${terminologyLabel.toLowerCase()}`}
              loading={wellModesLoading}
              disabled={!formData.branch_id}
              listHeight={100}
              allowClear
            >
              {wellModes.map(mode => (
                <Option key={mode.id} value={mode.name}>
                  {mode.name}
                </Option>
              ))}
            </Select>
          </div>
        )}

        {canShow('sampling_date') && (
          <div className="form-group">
            <label>Дата отбора пробы</label>
            <DatePicker
              format="DD.MM.YYYY"
              value={formData.sampling_date}
              onChange={handleDateChange('sampling_date')}
              placeholder="ДД.ММ.ГГГГ"
              className="custom-date-picker"
              rootClassName="custom-date-picker-root"
              popupClassName="custom-date-picker-popup"
              inputReadOnly={false}
              allowClear={true}
            />
          </div>
        )}

        {canShow('receipt_date') && (
          <div className="form-group">
            <label>Дата получения пробы</label>
            <DatePicker
              format="DD.MM.YYYY"
              value={formData.receiving_date}
              onChange={handleDateChange('receiving_date')}
              placeholder="ДД.ММ.ГГГГ"
              className="custom-date-picker"
              rootClassName="custom-date-picker-root"
              popupClassName="custom-date-picker-popup"
              inputReadOnly={false}
              allowClear={true}
            />
          </div>
        )}

        <div className="form-group">
          <label>
            Добавил пробу <span className="required">*</span>
          </label>
          <UserPicker
            value={addedByEmployee}
            onChange={() => {}}
            placeholder="ФИО лица, добавившего пробу"
            disabled={true}
            allowClear={false}
          />
        </div>

        {selectionConditionsFields.length > 0 && (
          <SelectionConditionsForm
            conditions={selectionConditionsFields}
            values={selectionConditions}
            onChange={handleSelectionConditionChange}
          />
        )}
      </div>
    </Modal>
  );
};

export default EditSampleModal;
