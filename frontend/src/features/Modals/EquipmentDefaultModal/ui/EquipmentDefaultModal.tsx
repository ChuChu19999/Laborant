import React, { useState, useEffect, useCallback } from 'react';
import { Spin, Typography, Form } from 'antd';
import { equipmentApi } from '../../../../shared/api/equipment';
import { useUpdateResearchMethod } from '../../../../shared/model/hooks';
import { useAutoRefetchQuery } from '../../../../shared/model/lib/useQuery';
import { Select } from '../../../../shared/ui/FormItems';
import { Modal } from '../../../../shared/ui/Modal';
import type { ResearchMethod } from '../../../../shared/api/research';
import './EquipmentDefaultModal.css';

const { Text } = Typography;

interface EquipmentDefaultModalProps {
  open: boolean;
  onClose: () => void;
  currentMethod?: ResearchMethod;
  laboratoryId?: number;
  departmentId?: number;
}

const EquipmentDefaultModal: React.FC<EquipmentDefaultModalProps> = ({
  open,
  onClose,
  currentMethod,
  laboratoryId,
  departmentId,
}) => {
  const [selectedEquipment, setSelectedEquipment] = useState<number[]>([]);

  const updateMethodMutation = useUpdateResearchMethod();

  const { data: equipmentData, isLoading: loadingEquipment } = useAutoRefetchQuery(
    ['equipment', laboratoryId, departmentId],
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

  const equipment = equipmentData?.items.filter(eq => !eq.deleted_at) || [];

  useEffect(() => {
    if (open && currentMethod) {
      setSelectedEquipment(currentMethod.equipment_data_default || []);
    }
  }, [open, currentMethod]);

  const handleSave = useCallback(async () => {
    if (!currentMethod) {
      return;
    }

    try {
      await updateMethodMutation.mutateAsync({
        id: currentMethod.id,
        data: {
          equipment_data_default: selectedEquipment,
        },
      });
      onClose();
    } catch (error) {
      console.error('Ошибка при сохранении:', error);
    }
  }, [currentMethod, selectedEquipment, onClose, updateMethodMutation]);

  const handleModalClose = useCallback(() => {
    if (currentMethod) {
      setSelectedEquipment(currentMethod.equipment_data_default || []);
    }
    onClose();
  }, [currentMethod, onClose]);

  if (!open) return null;

  return (
    <Modal
      header="Приборы по умолчанию"
      onClose={handleModalClose}
      onCancel={handleModalClose}
      showEditButton={false}
      editable={false}
      modalWidth="550"
      onSave={handleSave}
    >
      <div className="equipment-default-modal-content">
        <Form layout="vertical">
          <Form.Item
            label="Выберите приборы по умолчанию"
            className="equipment-default-modal-form-item"
          >
            {loadingEquipment ? (
              <div className="equipment-default-modal-spin-container">
                <Spin size="large" />
              </div>
            ) : (
              <>
                <Select
                  mode="multiple"
                  placeholder="Выберите оборудование"
                  value={selectedEquipment}
                  onChange={(value: unknown) => {
                    setSelectedEquipment(value as number[]);
                  }}
                  className="equipment-default-modal-select"
                  optionFilterProp="children"
                  showSearch={false}
                  listHeight={110}
                  maxTagCount="responsive"
                  virtual={false}
                  popupClassName="equipment-select-dropdown"
                >
                  {equipment.map(item => (
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
                {equipment.length === 0 && !loadingEquipment && (
                  <Text type="secondary" className="equipment-default-modal-text-block">
                    Нет доступного оборудования
                  </Text>
                )}
              </>
            )}
          </Form.Item>

          <div className="equipment-default-modal-info-box">
            <Text>
              Выбранные приборы будут автоматически подгружаться при создании расчетов для этого
              метода.
            </Text>
          </div>
        </Form>
      </div>
    </Modal>
  );
};

export default EquipmentDefaultModal;
