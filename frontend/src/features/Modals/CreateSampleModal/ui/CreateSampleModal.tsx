import React, { useCallback, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { SelectionConditionsForm } from '../../../../entities/SelectionConditionsForm';
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
    mode: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectionConditions, setSelectionConditions] = useState<Record<string, string>>({});

  const { data: sampleTypes = [] } = useAutoRefetchQuery<string[]>(['sample-types'], () =>
    samplesApi.getSampleTypes()
  );

  // Запрос на получение филиалов
  const { data: branchesData, isLoading: branchesLoading } = useAutoRefetchQuery<{
    items: Branch[];
  }>(
    ['branches', laboratoryId, departmentId],
    () => samplingLocationsApi.getBranches(laboratoryId, departmentId, { page_size: 100 }),
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
    () => samplingLocationsApi.getSamplingLocations(formData.branch_id, { page_size: 100 }),
    {
      enabled: !!formData.branch_id,
    }
  );

  const samplingLocations = samplingLocationsData?.items || [];

  // Запрос на получение полей условий отбора
  const { data: selectionConditionsFields = [] } = useAutoRefetchQuery<SelectionConditionsField[]>(
    ['selection-conditions-fields', laboratoryId, departmentId],
    () => samplesApi.getSelectionConditionsFields(laboratoryId!, departmentId),
    {
      enabled: !!laboratoryId,
    }
  );

  const handleInputChange = useCallback(
    (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData(prev => {
        const newData = {
          ...prev,
          [field]: e.target.value,
        };

        return newData;
      });

      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: '' }));
      }
    },
    [errors]
  );

  const handleSelectChange = useCallback(
    (field: 'sample_type' | 'test_object' | 'branch_id' | 'sampling_location_id') =>
      (value: unknown) => {
        setFormData(prev => {
          const newData = {
            ...prev,
            [field]: value as (typeof formData)[typeof field],
          };

          // Сбрасываем место отбора при изменении филиала
          if (field === 'branch_id') {
            newData.sampling_location_id = undefined;
          }

          return newData;
        });

        if (errors[field]) {
          setErrors(prev => ({ ...prev, [field]: '' }));
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
        setErrors(prev => ({ ...prev, [field]: '' }));
      }
    },
    [errors]
  );

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    const requiredFields = ['registration_number', 'sample_type', 'test_object'];

    requiredFields.forEach(field => {
      if (!formData[field as keyof typeof formData]) {
        newErrors[field] = 'Это поле обязательно для заполнения';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
      mode: '',
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
      mode: '',
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
      style={{ width: '600px' }}
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
          {errors.registration_number && (
            <div className="error-message">{errors.registration_number}</div>
          )}
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
          {errors.sample_type && <div className="error-message">{errors.sample_type}</div>}
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
          {errors.test_object && <div className="error-message">{errors.test_object}</div>}
        </div>

        <div className="form-group">
          <label>Филиал</label>
          <Select
            value={formData.branch_id}
            onChange={handleSelectChange('branch_id')}
            placeholder="Выберите филиал"
            loading={branchesLoading}
            status={errors.branch_id ? 'error' : ''}
            listHeight={100}
            allowClear
          >
            {branches.map(branch => (
              <Option key={branch.id} value={branch.id}>
                {branch.name}
              </Option>
            ))}
          </Select>
          {errors.branch_id && <div className="error-message">{errors.branch_id}</div>}
        </div>

        <div className="form-group">
          <label>Место отбора пробы</label>
          <Select
            value={formData.sampling_location_id}
            onChange={handleSelectChange('sampling_location_id')}
            placeholder="Выберите место отбора пробы"
            loading={locationsLoading}
            status={errors.sampling_location_id ? 'error' : ''}
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
          {errors.sampling_location_id && (
            <div className="error-message">{errors.sampling_location_id}</div>
          )}
        </div>

        <div className="form-group">
          <label>Скважина</label>
          <Input
            value={formData.well}
            onChange={handleInputChange('well')}
            placeholder="Введите скважину"
            status={errors.well ? 'error' : ''}
          />
          {errors.well && <div className="error-message">{errors.well}</div>}
        </div>

        <div className="form-group">
          <label>Режим</label>
          <Input
            value={formData.mode}
            onChange={handleInputChange('mode')}
            placeholder="Введите режим"
            status={errors.mode ? 'error' : ''}
          />
          {errors.mode && <div className="error-message">{errors.mode}</div>}
        </div>

        <div className="form-group">
          <label>Дата отбора пробы</label>
          <DatePicker
            format="DD.MM.YYYY"
            value={formData.sampling_date}
            onChange={handleDateChange('sampling_date')}
            placeholder="ДД.ММ.ГГГГ"
            status={errors.sampling_date ? 'error' : ''}
            className="custom-date-picker"
            rootClassName="custom-date-picker-root"
            popupClassName="custom-date-picker-popup"
            inputReadOnly={false}
            allowClear={true}
          />
          {errors.sampling_date && <div className="error-message">{errors.sampling_date}</div>}
        </div>

        <div className="form-group">
          <label>Дата получения пробы</label>
          <DatePicker
            format="DD.MM.YYYY"
            value={formData.receiving_date}
            onChange={handleDateChange('receiving_date')}
            placeholder="ДД.ММ.ГГГГ"
            status={errors.receiving_date ? 'error' : ''}
            className="custom-date-picker"
            rootClassName="custom-date-picker-root"
            popupClassName="custom-date-picker-popup"
            inputReadOnly={false}
            allowClear={true}
          />
          {errors.receiving_date && <div className="error-message">{errors.receiving_date}</div>}
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
