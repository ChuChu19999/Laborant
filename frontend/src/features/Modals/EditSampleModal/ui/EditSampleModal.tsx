import React, { useState, useCallback, useEffect } from 'react';
import { message } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { SelectionConditionsForm } from '../../../../entities/SelectionConditionsForm';
import { samplesApi } from '../../../../shared/api/samples';
import {
  samplingLocationsApi,
  type Branch,
  type SamplingLocation,
} from '../../../../shared/api/samplingLocations';
import { useUpdateSample } from '../../../../shared/model/hooks';
import { useAutoRefetchQuery } from '../../../../shared/model/lib/useQuery';
import { Input, Select, DatePicker } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import type {
  Sample,
  SampleUpdate,
  SelectionConditionsField,
} from '../../../../shared/api/samples';
import './EditSampleModal.css';

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
  const updateSampleMutation = useUpdateSample();
  const [formData, setFormData] = useState({
    registration_number: sample.registration_number,
    sample_type: sample.sample_type as string | undefined,
    test_object: sample.test_object as string | undefined,
    sampling_date: sample.sampling_date ? dayjs(sample.sampling_date) : null,
    receiving_date: sample.receiving_date ? dayjs(sample.receiving_date) : null,
    branch_id: sample.branch_id as number | undefined,
    sampling_location_id: sample.sampling_location_id as number | undefined,
    well: sample.well || '',
    mode: sample.mode || '',
  });
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const { data: sampleTypes = [] } = useAutoRefetchQuery<string[]>(['sample-types'], () =>
    samplesApi.getSampleTypes()
  );

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

  const { data: selectionConditionsFields = [] } = useAutoRefetchQuery<SelectionConditionsField[]>(
    ['selection-conditions-fields', laboratoryId, departmentId],
    () => samplesApi.getSelectionConditionsFields(laboratoryId!, departmentId),
    {
      enabled: !!laboratoryId,
    }
  );

  const [selectionConditions, setSelectionConditions] = useState<Record<string, string>>({});

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
        mode: sample.mode || '',
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
    (field: 'sample_type' | 'test_object' | 'branch_id' | 'sampling_location_id') =>
      (value: unknown) => {
        setFormData(prev => {
          const newData = {
            ...prev,
            [field]: value as (typeof formData)[typeof field],
          };

          if (field === 'branch_id') {
            newData.sampling_location_id = undefined;
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
    const requiredFields = ['registration_number', 'sample_type', 'test_object'];
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
      sample_type: formData.sample_type,
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
      mode: sample.mode || '',
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
          <Input
            value={formData.mode}
            onChange={handleInputChange('mode')}
            placeholder="Введите режим"
          />
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
