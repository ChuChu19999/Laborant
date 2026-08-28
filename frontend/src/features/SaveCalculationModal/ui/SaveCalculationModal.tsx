import { UserPicker } from '@/entities/Employee';
import { FormField } from '@/shared/ui/FormField';
import { Select } from '@/shared/ui/FormItems';
import { Modal } from '@/shared/ui/Modal';
import { Typography } from '@/shared/ui/Typography';
import { useSaveCalculationModal } from '../model/useSaveCalculationModal';
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
  researchMethodIncludeDeleted?: boolean;
  equipment_data?: number[];
  editingCalculationId?: number;
  /** ID приборов из сохраненного расчёта (включая обязательные); для выбора необязательных при редактировании. */
  existingEquipmentData?: number[];
  /** hsnils исполнителя из заменяемого расчёта — подставить в форму при открытии. */
  previousExecutorHash?: string | null;
}

const SaveCalculationModal = ({
  open,
  onClose,
  onSuccess,
  calculationData,
  laboratoryActivityDate,
  sampleId,
  laboratoryId,
  departmentId,
  researchMethodId,
  researchMethodIncludeDeleted = false,
  equipment_data,
  editingCalculationId,
  existingEquipmentData,
  previousExecutorHash,
}: SaveCalculationModalProps) => {
  const modal = useSaveCalculationModal({
    open,
    onClose,
    onSuccess,
    calculationData,
    laboratoryActivityDate,
    sampleId,
    laboratoryId,
    departmentId,
    researchMethodId,
    researchMethodIncludeDeleted,
    equipment_data,
    editingCalculationId,
    existingEquipmentData,
    previousExecutorHash,
  });

  if (!open) return null;

  return (
    <div className="save-calculation-modal-wrapper">
      <Modal
        header={
          modal.editingCalculationId
            ? 'Сохранение новой версии расчёта'
            : 'Сохранение результата расчёта'
        }
        onClose={modal.handleCancel}
        onCancel={modal.handleCancel}
        onSave={modal.handleSave}
        modalWidth="550"
        saveButtonText={modal.editingCalculationId ? 'Сохранить как новый расчёт' : 'Сохранить'}
      >
        <div className="save-calculation-modal-content">
          {!sampleId ? (
            <FormField
              label={
                <>
                  Регистрационный номер пробы <span className="required">*</span>
                </>
              }
              labelClassName="save-calculation-modal-label"
              itemClassName="save-calculation-modal-field"
              error={
                modal.sampleError ? (
                  <div className="save-calculation-modal-error">{modal.sampleError}</div>
                ) : undefined
              }
            >
              {fieldId => (
                <Select
                  id={fieldId}
                  value={modal.selectedSampleId}
                  onChange={value => modal.handleSampleChange(value as number | undefined)}
                  placeholder="Выберите пробу"
                  loading={modal.samplesLoading}
                  allowClear
                  showSearch
                  filterOption={(input, option) => {
                    const sample = modal.samples.find(s => s.id === option?.value);
                    return sample
                      ? sample.registration_number.toLowerCase().includes(input.toLowerCase())
                      : false;
                  }}
                  listHeight={200}
                  status={modal.sampleError ? 'error' : ''}
                >
                  {modal.samples.map(sample => (
                    <Option key={sample.id} value={sample.id}>
                      {sample.registration_number} - {sample.test_object}
                    </Option>
                  ))}
                </Select>
              )}
            </FormField>
          ) : null}
          <FormField
            label={
              <>
                Исполнитель <span className="required">*</span>
              </>
            }
            labelClassName="save-calculation-modal-label"
            itemClassName="save-calculation-modal-field"
          >
            {fieldId => (
              <UserPicker
                id={fieldId}
                value={modal.executor}
                onChange={modal.handleExecutorChange}
                placeholder="Введите ФИО исполнителя"
                error={modal.executorError}
                laboratoryName={modal.laboratoryName}
              />
            )}
          </FormField>

          {modal.showEquipmentField ? (
            <FormField
              label="Приборы"
              labelClassName="save-calculation-modal-label"
              itemClassName="save-calculation-modal-field"
              labelMode="group"
            >
              {(_fieldId, labelId) => (
                <div aria-labelledby={labelId}>
                  {modal.isLoadingEquipment ? (
                    <div className="save-calculation-modal-equipment-loading">
                      <Text type="secondary">Загрузка приборов...</Text>
                    </div>
                  ) : (
                    <Select
                      mode="multiple"
                      value={modal.allSelectedEquipment}
                      onChange={value => modal.handleEquipmentChange(value as number[])}
                      placeholder="Выберите приборы"
                      disabled={
                        modal.availableEquipment.required.length === 0 &&
                        modal.availableEquipment.selectable.length === 0
                      }
                      listHeight={200}
                      maxTagCount="responsive"
                      tagRender={props => {
                        const isRequired = modal.availableEquipment.required.some(
                          eq => eq.id === props.value
                        );
                        return (
                          <span
                            className={
                              isRequired
                                ? 'save-calculation-equipment-tag save-calculation-equipment-tag--required'
                                : 'save-calculation-equipment-tag'
                            }
                          >
                            {props.label}
                            {!isRequired ? (
                              <button
                                type="button"
                                className="save-calculation-equipment-tag-remove"
                                aria-label="Убрать оборудование"
                                onClick={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  modal.removeOptionalEquipment(props.value as number);
                                }}
                              >
                                ×
                              </button>
                            ) : null}
                          </span>
                        );
                      }}
                    >
                      {[
                        ...modal.availableEquipment.selectable,
                        ...modal.availableEquipment.required,
                      ].map(eq => (
                        <Option
                          key={eq.id}
                          value={eq.id}
                          disabled={modal.availableEquipment.required.some(req => req.id === eq.id)}
                        >
                          <div>
                            <Text>{eq.name}</Text>
                            <br />
                            <Text type="secondary" className="save-calculation-equipment-serial">
                              {`Зав. № ${eq.serial_number}`}
                            </Text>
                          </div>
                        </Option>
                      ))}
                    </Select>
                  )}
                  {modal.availableEquipment.required.length > 0 ? (
                    <Text type="secondary" className="save-calculation-equipment-hint">
                      Приборы, отмеченные серым цветом, обязательны и не могут быть удалены
                    </Text>
                  ) : null}
                </div>
              )}
            </FormField>
          ) : null}
        </div>
      </Modal>
    </div>
  );
};

export default SaveCalculationModal;
