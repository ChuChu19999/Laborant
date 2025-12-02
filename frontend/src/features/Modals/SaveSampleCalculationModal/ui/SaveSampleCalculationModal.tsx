import { useState, useEffect, useCallback } from 'react';
import { Form, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { UserPicker, type Employee } from '../../../../entities/UserPicker';
import { calculationApi, type CalculationCreate } from '../../../../shared/api/calculation';
import { employeesApi } from '../../../../shared/api/employees';
import { type ResearchMethodResponse } from '../../../../shared/api/research';
import Modal from '../../../../shared/ui/Modal/ui/Modal';
import './SaveSampleCalculationModal.css';

interface SaveSampleCalculationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  sampleId: number;
  calculationResult: {
    input_data: Record<string, unknown>;
    result: string;
    measurement_error?: string;
    convergence?: string;
    laboratory_activity_date?: string;
  } | null;
  currentMethod: ResearchMethodResponse | null;
  laboratoryActivityDate: Dayjs | null;
  laboratoryId: number;
  departmentId?: number;
}

const SaveSampleCalculationModal: React.FC<SaveSampleCalculationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  sampleId,
  calculationResult,
  currentMethod,
  laboratoryActivityDate,
  laboratoryId,
  departmentId,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [selectedExecutor, setSelectedExecutor] = useState<Employee | null>(null);
  const [executorError, setExecutorError] = useState('');

  const fetchLaboratoryName = useCallback(async () => {
    if (!laboratoryId) return;

    try {
      await employeesApi.getLaboratoryById(laboratoryId);
    } catch (error) {
      console.error('Ошибка при получении названия лаборатории:', error);
    }
  }, [laboratoryId]);

  useEffect(() => {
    if (isOpen) {
      fetchLaboratoryName();
    }
  }, [isOpen, fetchLaboratoryName]);

  const handleSave = async () => {
    try {
      if (!selectedExecutor) {
        setExecutorError('Необходимо выбрать исполнителя из списка');
        return;
      }

      setExecutorError('');
      setError(null);

      if (!calculationResult || !currentMethod) {
        setError('Отсутствуют данные расчета');
        return;
      }

      const convergenceValue = calculationResult.convergence;
      let result: string;
      let measurement_error: string | undefined;

      if (
        convergenceValue &&
        ['Неудовлетворительно', 'Следы', 'Отсутствие'].includes(convergenceValue)
      ) {
        result = convergenceValue;
        measurement_error = '-';
      } else if (calculationResult.result) {
        result = calculationResult.result;
        measurement_error = calculationResult.measurement_error;
      } else {
        setError('Отсутствует результат расчета');
        return;
      }

      const requestData: CalculationCreate = {
        input_data: calculationResult.input_data || {},
        equipment_data: currentMethod.equipment_data_default || [],
        unit: currentMethod.unit,
        laboratory_activity_date: calculationResult.laboratory_activity_date
          ? dayjs(calculationResult.laboratory_activity_date).format('YYYY-MM-DD')
          : laboratoryActivityDate?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
        laboratory_id: laboratoryId,
        department_id: departmentId,
        sample_id: sampleId,
        research_method_id: currentMethod.id,
        executor: selectedExecutor.hashMd5,
        result: result.toString(),
        measurement_error: measurement_error ? measurement_error.toString() : undefined,
      };

      await calculationApi.createCalculation(requestData);

      message.success('Расчет успешно сохранен');
      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      console.error('Ошибка при сохранении расчета:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as {
          response?: { data?: { executor?: string | string[]; error?: string; detail?: string } };
        };
        if (axiosError.response?.data) {
          if (axiosError.response.data.executor) {
            setExecutorError(
              Array.isArray(axiosError.response.data.executor)
                ? axiosError.response.data.executor[0]
                : axiosError.response.data.executor
            );
          } else {
            const errorMessage =
              axiosError.response.data.error ||
              axiosError.response.data.detail ||
              'Произошла ошибка при сохранении расчета';
            setError(errorMessage);
          }
        }
      } else {
        setError('Произошла ошибка при сохранении расчета');
      }
    }
  };

  const handleModalClose = () => {
    setExecutorError('');
    setError(null);
    setSelectedExecutor(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={handleModalClose} />
      <div className="modal-wrapper-custom">
        <Modal
          header="Подтверждение сохранения"
          onClose={handleModalClose}
          onCancel={handleModalClose}
          onSave={handleSave}
          saveButtonText="Сохранить"
          showEditButton={false}
          editable={false}
        >
          <div className="save-sample-calculation-form">
            <Form layout="vertical">
              <Form.Item
                label="Исполнитель"
                required
                validateStatus={executorError ? 'error' : ''}
                help={executorError}
              >
                <UserPicker
                  value={selectedExecutor}
                  onChange={employee => {
                    setSelectedExecutor(employee);
                    setExecutorError('');
                  }}
                  placeholder="Введите ФИО исполнителя"
                  error={executorError}
                />
              </Form.Item>

              {error && (
                <p className="error-message" style={{ color: '#ff4d4f', marginTop: '8px' }}>
                  {error}
                </p>
              )}
            </Form>
          </div>
        </Modal>
      </div>
    </>
  );
};

export default SaveSampleCalculationModal;
