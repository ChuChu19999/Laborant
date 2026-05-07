import React, { useState, useEffect, useMemo } from 'react';
import { Typography, message } from 'antd';
import { UserPicker, type Employee } from '../../../../entities/UserPicker';
import { calculationApi } from '../../../../shared/api/calculation';
import { employeesApi } from '../../../../shared/api/employees';
import { equipmentApi } from '../../../../shared/api/equipment';
import { laboratoriesApi } from '../../../../shared/api/laboratories';
import { researchApi } from '../../../../shared/api/research';
import { samplesApi, type Sample } from '../../../../shared/api/samples';
import { useAutoRefetchQuery } from '../../../../shared/model/lib/useQuery';
import { Select } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import type { Dayjs } from 'dayjs';
import './SaveCalculationModal.css';

const { Option } = Select;
const { Text } = Typography;

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
  editingCalculationId?: number;
  /** ID приборов из сохранённого расчёта (включая обязательные); для выбора необязательных при редактировании. */
  existingEquipmentData?: number[];
  /** hashMd5 исполнителя из заменяемого расчёта — подставить в форму при открытии. */
  previousExecutorHash?: string | null;
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
  editingCalculationId,
  existingEquipmentData,
  previousExecutorHash,
}) => {
  const [executor, setExecutor] = useState<Employee | null>(null);
  const [executorError, setExecutorError] = useState('');
  const [selectedSampleId, setSelectedSampleId] = useState<number | undefined>(sampleId);
  const [sampleError, setSampleError] = useState('');
  const [laboratoryName, setLaboratoryName] = useState<string>('');
  const [selectedEquipment, setSelectedEquipment] = useState<number[]>([]);

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

  // Запрос на получение названия лаборатории
  const { data: laboratory } = useAutoRefetchQuery(
    ['laboratory', laboratoryId],
    () => laboratoriesApi.getLaboratory(laboratoryId),
    {
      enabled: open && !!laboratoryId,
    }
  );

  // Запрос на получение метода исследования
  const { data: researchMethod } = useAutoRefetchQuery(
    ['research-method', researchMethodId],
    () => researchApi.getResearchMethod(researchMethodId),
    {
      enabled: open && !!researchMethodId,
    }
  );

  // Запрос на получение приборов
  const { data: equipmentData, isLoading: isLoadingEquipment } = useAutoRefetchQuery(
    ['equipment', 'for-calculation', laboratoryId, departmentId],
    () =>
      equipmentApi.getEquipment(
        undefined,
        undefined,
        undefined,
        undefined,
        laboratoryId,
        departmentId
      ),
    {
      enabled: open && !!laboratoryId,
    }
  );

  const availableEquipment = useMemo(() => {
    if (!equipmentData?.items || !researchMethod) {
      return { selectable: [], required: [] };
    }

    const allEquipment = equipmentData.items.filter(eq => !eq.deleted_at);
    const requiredEquipmentIds = researchMethod.equipment_data_default || [];
    const requiredEquipment = allEquipment.filter(eq => requiredEquipmentIds.includes(eq.id));

    const selectableEquipment = allEquipment.filter(
      eq =>
        eq.method_data_default?.includes(researchMethodId) && !requiredEquipmentIds.includes(eq.id)
    );

    return {
      selectable: selectableEquipment,
      required: requiredEquipment,
    };
  }, [equipmentData, researchMethod, researchMethodId]);

  const allSelectedEquipment = useMemo(() => {
    const requiredIds = availableEquipment.required.map(eq => eq.id);
    return [...selectedEquipment, ...requiredIds];
  }, [selectedEquipment, availableEquipment.required]);

  useEffect(() => {
    if (laboratory?.full_name) {
      setLaboratoryName(laboratory.full_name);
    }
  }, [laboratory]);

  const samples = useMemo(() => samplesData?.items || [], [samplesData?.items]);

  useEffect(() => {
    if (open) {
      setSelectedSampleId(sampleId);
      if (!previousExecutorHash) {
        setExecutor(null);
      }
      setExecutorError('');
      setSampleError('');
      if (!editingCalculationId && researchMethod?.equipment_data_default) {
        setSelectedEquipment([]);
      }
    }
  }, [open, sampleId, researchMethod, editingCalculationId, previousExecutorHash]);

  useEffect(() => {
    if (!open || !previousExecutorHash?.trim()) {
      return;
    }
    let cancelled = false;
    void employeesApi.getByHash(previousExecutorHash.trim(), false).then(data => {
      if (!cancelled && data && typeof data === 'object' && 'hashMd5' in data) {
        setExecutor(data as Employee);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, previousExecutorHash]);

  useEffect(() => {
    if (!open || !researchMethod || !editingCalculationId) {
      return;
    }
    const rawIds = existingEquipmentData ?? [];
    const requiredIds = researchMethod.equipment_data_default || [];
    const optionalOnly = rawIds.filter(id => !requiredIds.includes(id));
    setSelectedEquipment(optionalOnly);
  }, [open, editingCalculationId, existingEquipmentData, researchMethod]);

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
      const resolvedEquipment =
        allSelectedEquipment.length > 0 ? allSelectedEquipment : equipment_data;

      if (editingCalculationId) {
        await calculationApi.replaceCalculation(editingCalculationId, {
          sample_id: finalSampleId,
          laboratory_id: laboratoryId,
          department_id: departmentId,
          research_method_id: researchMethodId,
          input_data: calculationData.input_data,
          equipment_data: resolvedEquipment,
          result: calculationData.result,
          executor: executor.hashMd5,
          measurement_error: calculationData.measurement_error,
          unit: calculationData.unit,
          laboratory_activity_date: laboratoryActivityDate.format('YYYY-MM-DD'),
        });
        message.success('Сохранена новая версия расчёта; предыдущая помечена удалена');
      } else {
        await calculationApi.createCalculation({
          sample_id: finalSampleId,
          laboratory_id: laboratoryId,
          department_id: departmentId,
          research_method_id: researchMethodId,
          input_data: calculationData.input_data,
          equipment_data: resolvedEquipment,
          result: calculationData.result,
          executor: executor.hashMd5,
          measurement_error: calculationData.measurement_error,
          unit: calculationData.unit,
          laboratory_activity_date: laboratoryActivityDate.format('YYYY-MM-DD'),
        });

        message.success('Результат расчета успешно сохранен');
      }
      setExecutor(null);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Ошибка при сохранении расчета:', error);
      message.error('Не удалось сохранить результат расчета');
      throw error;
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
        header={
          editingCalculationId ? 'Сохранение новой версии расчёта' : 'Сохранение результата расчета'
        }
        onClose={handleCancel}
        onCancel={handleCancel}
        onSave={handleSave}
        modalWidth="550"
        saveButtonText={editingCalculationId ? 'Сохранить как новый расчёт' : 'Сохранить'}
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
              laboratoryName={laboratoryName}
            />
          </div>

          <div className="save-calculation-modal-field">
            <label className="save-calculation-modal-label">Приборы</label>
            {isLoadingEquipment ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Text type="secondary">Загрузка приборов...</Text>
              </div>
            ) : (
              <Select
                mode="multiple"
                value={allSelectedEquipment}
                onChange={value => {
                  const requiredIds = availableEquipment.required.map(eq => eq.id);
                  const newSelected = (value as number[]).filter(id => !requiredIds.includes(id));
                  setSelectedEquipment(newSelected);
                }}
                placeholder="Выберите приборы"
                disabled={
                  availableEquipment.required.length === 0 &&
                  availableEquipment.selectable.length === 0
                }
                listHeight={200}
                maxTagCount="responsive"
                tagRender={props => {
                  const isRequired = availableEquipment.required.some(eq => eq.id === props.value);
                  return (
                    <span
                      style={{
                        display: 'inline-block',
                        marginRight: '4px',
                        padding: '2px 8px',
                        background: isRequired ? '#f0f0f0' : '#e6f7ff',
                        border: `1px solid ${isRequired ? '#d9d9d9' : '#91d5ff'}`,
                        borderRadius: '4px',
                        opacity: isRequired ? 0.6 : 1,
                      }}
                    >
                      {props.label}
                      {!isRequired && (
                        <span
                          onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            const newSelected = selectedEquipment.filter(id => id !== props.value);
                            setSelectedEquipment(newSelected);
                          }}
                          style={{ marginLeft: '4px', cursor: 'pointer' }}
                        >
                          ×
                        </span>
                      )}
                    </span>
                  );
                }}
              >
                {[...availableEquipment.selectable, ...availableEquipment.required].map(eq => (
                  <Option
                    key={eq.id}
                    value={eq.id}
                    disabled={availableEquipment.required.some(req => req.id === eq.id)}
                  >
                    <div>
                      <Text>{eq.name}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {`Зав. № ${eq.serial_number}`}
                      </Text>
                    </div>
                  </Option>
                ))}
              </Select>
            )}
            {availableEquipment.required.length > 0 && (
              <Text
                type="secondary"
                style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}
              >
                Приборы, отмеченные серым цветом, обязательны и не могут быть удалены
              </Text>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SaveCalculationModal;
