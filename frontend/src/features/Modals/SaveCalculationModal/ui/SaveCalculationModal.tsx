import React, { useState, useEffect, useMemo } from 'react';
import { message } from 'antd';
import { UserPicker, type Employee } from '../../../../entities/UserPicker';
import { calculationApi } from '../../../../shared/api/calculation';
import { samplesApi, type Sample } from '../../../../shared/api/samples';
import { useAutoRefetchQuery } from '../../../../shared/model/lib/useQuery';
import { Select } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import type { Dayjs } from 'dayjs';
import './SaveCalculationModal.css';

const { Option } = Select;

interface SaveCalculationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  calculationData: {
    input_data: Record<string, unknown>;
    result: string;
    measurement_error?: string;
    unit?: string;
  };
  laboratoryActivityDate: Dayjs | null;
  sampleId?: number;
  laboratoryId: number;
  departmentId?: number;
  researchMethodId: number;
  equipment_data?: number[];
}

const SaveCalculationModal: React.FC<SaveCalculationModalProps> = ({
  open,
  onClose,
  onSuccess,
  calculationData,
  laboratoryActivityDate,
  sampleId,
  laboratoryId,
  departmentId,
  researchMethodId,
  equipment_data,
}) => {
  const [executor, setExecutor] = useState<Employee | null>(null);
  const [executorError, setExecutorError] = useState('');
  const [selectedSampleId, setSelectedSampleId] = useState<number | undefined>(sampleId);
  const [sampleError, setSampleError] = useState('');

  // Запрос на получение проб для выбора (только если sampleId не передан)
  const { data: samplesData, isLoading: samplesLoading } = useAutoRefetchQuery<{
    items: Sample[];
    total: number;
  }>(
    ['samples', 'for-calculation', laboratoryId, departmentId],
    () =>
      samplesApi
        .getSamples(undefined, undefined, undefined, undefined, laboratoryId, departmentId)
        .then(data => ({
          items: data.items,
          total: data.total,
        })),
    {
      enabled: open && !sampleId && !!laboratoryId,
    }
  );

  const samples = useMemo(() => samplesData?.items || [], [samplesData?.items]);

  useEffect(() => {
    if (open) {
      setSelectedSampleId(sampleId);
      setExecutor(null);
      setExecutorError('');
      setSampleError('');
    }
  }, [open, sampleId]);

  const handleSave = async () => {
    const finalSampleId = sampleId ?? selectedSampleId;

    if (!finalSampleId) {
      setSampleError('Необходимо указать пробу');
      message.warning('Укажите пробу');
      return;
    }

    if (!executor || !executor.hashMd5) {
      setExecutorError('Необходимо указать исполнителя');
      message.warning('Укажите исполнителя');
      return;
    }

    if (!laboratoryActivityDate) {
      message.warning('Необходимо указать дату лабораторной деятельности');
      return;
    }

    setExecutorError('');
    setSampleError('');

    try {
      await calculationApi.createCalculation({
        sample_id: finalSampleId,
        laboratory_id: laboratoryId,
        department_id: departmentId,
        research_method_id: researchMethodId,
        input_data: calculationData.input_data,
        equipment_data: equipment_data,
        result: calculationData.result,
        executor: executor.hashMd5,
        measurement_error: calculationData.measurement_error,
        unit: calculationData.unit,
        laboratory_activity_date: laboratoryActivityDate.format('YYYY-MM-DD'),
      });

      message.success('Результат расчета успешно сохранен');
      setExecutor(null);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Ошибка при сохранении расчета:', error);
      message.error('Не удалось сохранить результат расчета');
      throw error; // Пробрасываем ошибку, чтобы Modal мог обработать её
    }
  };

  const handleCancel = () => {
    setExecutor(null);
    setExecutorError('');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="save-calculation-modal-wrapper">
      <Modal
        header="Сохранение результата расчета"
        onClose={handleCancel}
        onCancel={handleCancel}
        onSave={handleSave}
        modalWidth="550"
        saveButtonText="Сохранить"
      >
        <div className="save-calculation-modal-content">
          {!sampleId && (
            <div className="save-calculation-modal-field">
              <label className="save-calculation-modal-label">
                Регистрационный номер пробы <span className="required">*</span>
              </label>
              <Select
                value={selectedSampleId}
                onChange={value => {
                  setSelectedSampleId(value as number | undefined);
                  setSampleError('');
                }}
                placeholder="Выберите пробу"
                loading={samplesLoading}
                allowClear
                showSearch
                filterOption={(input, option) => {
                  const sample = samples.find((s: Sample) => s.id === option?.value);
                  return sample
                    ? sample.registration_number.toLowerCase().includes(input.toLowerCase())
                    : false;
                }}
                listHeight={200}
                status={sampleError ? 'error' : ''}
              >
                {samples.map((sample: Sample) => (
                  <Option key={sample.id} value={sample.id}>
                    {sample.registration_number} - {sample.test_object}
                  </Option>
                ))}
              </Select>
              {sampleError && <div className="save-calculation-modal-error">{sampleError}</div>}
            </div>
          )}
          <div className="save-calculation-modal-field">
            <label className="save-calculation-modal-label">
              Исполнитель <span className="required">*</span>
            </label>
            <UserPicker
              value={executor}
              onChange={employee => {
                setExecutor(employee);
                setExecutorError('');
              }}
              placeholder="Введите ФИО исполнителя"
              error={executorError}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SaveCalculationModal;
