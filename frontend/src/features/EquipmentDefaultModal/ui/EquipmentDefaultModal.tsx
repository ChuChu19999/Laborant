import { Form } from '@/shared/ui/Form';
import { Select } from '@/shared/ui/FormItems';
import { Modal } from '@/shared/ui/Modal';
import { Spin } from '@/shared/ui/Spin';
import { Typography } from '@/shared/ui/Typography';
import { useEquipmentDefaultModal } from '../model/useEquipmentDefaultModal';
import type { ResearchMethod } from '@/entities/ResearchMethod';
import './EquipmentDefaultModal.css';

const { Text } = Typography;

interface EquipmentDefaultModalProps {
  open: boolean;
  onClose: () => void;
  currentMethod?: ResearchMethod;
  laboratoryId?: number;
  departmentId?: number;
}

const EquipmentDefaultModal = ({
  open,
  onClose,
  currentMethod,
  laboratoryId,
  departmentId,
}: EquipmentDefaultModalProps) => {
  const modal = useEquipmentDefaultModal({
    open,
    onClose,
    currentMethod,
    laboratoryId,
    departmentId,
  });

  if (!open) return null;

  return (
    <Modal
      header="Приборы по умолчанию"
      onClose={modal.handleModalClose}
      onCancel={modal.handleModalClose}
      showEditButton={false}
      editable={false}
      modalWidth="550"
      onSave={modal.handleSave}
    >
      <div className="equipment-default-modal-content">
        <Form layout="vertical">
          <Form.Item
            label="Выберите приборы по умолчанию"
            className="equipment-default-modal-form-item"
          >
            {modal.loadingEquipment ? (
              <div className="equipment-default-modal-spin-container">
                <Spin size="large" />
              </div>
            ) : (
              <>
                <Select
                  mode="multiple"
                  placeholder="Выберите оборудование"
                  value={modal.selectedEquipment}
                  onChange={(value: unknown) => {
                    modal.setSelectedEquipment(value as number[]);
                  }}
                  className="equipment-default-modal-select"
                  optionFilterProp="children"
                  showSearch={false}
                  listHeight={110}
                  maxTagCount="responsive"
                  virtual={false}
                  classNames={{ popup: { root: 'equipment-select-dropdown' } }}
                >
                  {modal.equipment.map(item => (
                    <Select.Option key={item.id} value={item.id}>
                      <div>
                        <Text>{item.name}</Text>
                        <br />
                        <Text type="secondary" className="equipment-default-modal-text-secondary">
                          {`Зав. № ${item.serial_number}`}
                        </Text>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
                {modal.equipment.length === 0 && !modal.loadingEquipment && (
                  <Text type="secondary" className="equipment-default-modal-text-block">
                    Нет доступного оборудования
                  </Text>
                )}
              </>
            )}
          </Form.Item>

          <div className="equipment-default-modal-info-box">
            <Text>
              Выбранные приборы будут автоматически подгружаться при создании расчётов для этого
              метода.
            </Text>
          </div>
        </Form>
      </div>
    </Modal>
  );
};

export default EquipmentDefaultModal;
