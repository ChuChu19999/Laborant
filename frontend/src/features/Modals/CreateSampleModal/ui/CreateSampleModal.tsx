import React, { useCallback, useState, useMemo } from 'react';
import { message } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { SelectionConditionsForm } from '../../../../entities/SelectionConditionsForm';
import { UserPicker, type Employee } from '../../../../entities/UserPicker';
import { laboratoriesApi } from '../../../../shared/api/laboratories';
import { samplesApi } from '../../../../shared/api/samples';
import { samplingLocationsApi } from '../../../../shared/api/samplingLocations';
import { useCreateSample } from '../../../../shared/model/hooks';
import { useAutoRefetchQuery } from '../../../../shared/model/lib/useQuery';
import { Input, Select, DatePicker } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import type { SampleCreate, SelectionConditionsField } from '../../../../shared/api/samples';
import type { Branch, SamplingLocation } from '../../../../shared/api/samplingLocations';
import './CreateSampleModal.css';

dayjs.locale('ru');

const { Option } = Select;

const TEST_OBJECT_OPTIONS = [
  { value: 'дегазированный конденсат', label: 'дегазированный конденсат' },
  { value: 'нефть', label: 'нефть' },
  { value: 'нефть калибровочная', label: 'нефть калибровочная' },
  { value: 'нефтеконденсатная смесь', label: 'нефтеконденсатная смесь' },
  { value: 'дизельное топливо', label: 'дизельное топливо' },
  { value: 'отработанные нефтепродукты', label: 'отработанные нефтепродукты' },
  { value: 'масло турбинное', label: 'масло турбинное' },
  { value: 'масло авиационное', label: 'масло авиационное' },
  { value: 'смесь жидких углеводородов', label: 'смесь жидких углеводородов' },
  { value: 'ингибитор коррозии', label: 'ингибитор коррозии' },
];

interface CreateSampleModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  laboratoryId?: number;
  departmentId?: number;
}

const CreateSampleModal: React.FC<CreateSampleModalProps> = ({
  open,
  onClose,
  onSuccess,
  laboratoryId,
  departmentId,
}) => {
  const createSampleMutation = useCreateSample();
  const [formData, setFormData] = useState({
    registration_number: '',
    sample_type: undefined as string | undefined,
    test_object: undefined as string | undefined,
    sampling_date: null as dayjs.Dayjs | null,
    receiving_date: null as dayjs.Dayjs | null,
    branch_id: undefined as number | undefined,
    sampling_location_id: undefined as number | undefined,
    well: '',
    mode: undefined as string | undefined,
    added_by: null as Employee | null,
  });
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [selectionConditions, setSelectionConditions] = useState<Record<string, string>>({});

  const { data: sampleTypes = [] } = useAutoRefetchQuery<string[]>(['sample-types'], () =>
    samplesApi.getSampleTypes()
  );

  // Запрос на получение филиалов
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

  // Запрос на получение мест отбора проб
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

  // Запрос на получение полей условий отбора
  const { data: selectionConditionsFields = [] } = useAutoRefetchQuery<SelectionConditionsField[]>(
    ['selection-conditions-fields', laboratoryId, departmentId],
    () => samplesApi.getSelectionConditionsFields(laboratoryId!, departmentId),
    {
      enabled: !!laboratoryId,
    }
  );

  // Запрос на получение названия лаборатории
  const { data: laboratory } = useAutoRefetchQuery(
    ['laboratory', laboratoryId],
    () => laboratoriesApi.getLaboratory(laboratoryId!),
    {
      enabled: !!laboratoryId,
    }
  );

  const laboratoryName = useMemo(() => laboratory?.full_name || '', [laboratory]);

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

  const validateForm = useCallback((): boolean => {
    const requiredFields = ['registration_number', 'sample_type', 'test_object', 'added_by'];
    const newErrors: Record<string, boolean> = {};

    requiredFields.forEach(field => {
      if (!formData[field as keyof typeof formData]) {
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

  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    // Преобразуем условия отбора: заменяем запятые на точки для числовых значений
    const processedSelectionConditions: Record<string, string> = {};
    Object.keys(selectionConditions).forEach(key => {
      const value = selectionConditions[key];
      if (value && value.trim() !== '') {
        processedSelectionConditions[key] = value.replace(',', '.');
      }
    });

    const sampleData: SampleCreate = {
      registration_number: formData.registration_number,
      sample_type: formData.sample_type!,
      test_object: formData.test_object!,
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
      selection_conditions:
        Object.keys(processedSelectionConditions).length > 0
          ? processedSelectionConditions
          : undefined,
      added_by: formData.added_by?.hashMd5 || undefined,
      laboratory_id: laboratoryId!,
      department_id: departmentId,
    };

    await createSampleMutation.mutateAsync(sampleData);
    setFormData({
      registration_number: '',
      sample_type: undefined,
      test_object: undefined,
      sampling_date: null,
      receiving_date: null,
      branch_id: undefined,
      sampling_location_id: undefined,
      well: '',
      mode: undefined as string | undefined,
      added_by: null,
    });
    setSelectionConditions({});
    setErrors({});
    onSuccess();
  }, [
    formData,
    selectionConditions,
    laboratoryId,
    departmentId,
    createSampleMutation,
    onSuccess,
    validateForm,
  ]);

  const handleSelectionConditionChange = useCallback((field: string, value: string) => {
    setSelectionConditions(prev => ({
      ...prev,
      [field]: value === '' ? '' : value,
    }));
  }, []);

  const handleCancel = useCallback(() => {
    setFormData({
      registration_number: '',
      sample_type: undefined,
      test_object: undefined,
      sampling_date: null,
      receiving_date: null,
      branch_id: undefined,
      sampling_location_id: undefined,
      well: '',
      mode: undefined as string | undefined,
      added_by: null,
    });
    setSelectionConditions({});
    setErrors({});
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <Modal
      header="Добавление пробы"
      onClose={onClose}
      onCancel={handleCancel}
      onSave={handleSave}
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

        <div className="form-group">
          <label>
            Тип пробы <span className="required">*</span>
          </label>
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
            {TEST_OBJECT_OPTIONS.map(option => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        </div>

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
                {branch.name}
              </Option>
            ))}
          </Select>
        </div>

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

        <div className="form-group">
          <label>Скважина</label>
          <Input
            value={formData.well}
            onChange={handleInputChange('well')}
            placeholder="Введите скважину"
          />
        </div>

        <div className="form-group">
          <label>Режим</label>
          <Select
            value={formData.mode}
            onChange={handleSelectChange('mode')}
            placeholder="Выберите режим"
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

        <div className="form-group">
          <label>
            Добавил пробу <span className="required">*</span>
          </label>
          <UserPicker
            value={formData.added_by}
            onChange={employee => setFormData(prev => ({ ...prev, added_by: employee }))}
            placeholder="Введите ФИО лица, добавившего пробу"
            laboratoryName={laboratoryName}
            error={errors.added_by ? 'Поле обязательно для заполнения' : undefined}
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

export default CreateSampleModal;
